import { AuditAction } from '#/core/logger/audit-action.js';
import { AuditLogService } from '#/core/logger/audit-log.service.js';
import { Prisma } from '#/generated/prisma/client.js';
import { OrganizationGenerationService } from '#/processor/authorization/organization-generation.service.js';
import { assertAcyclicParent } from '#/processor/utils/tree-cycle.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DepartmentRepository } from './department.repository.js';
import {
  CreateDepartmentDto,
  DepartmentSeedDto,
  UpdateDepartmentDto,
  type DepartmentLookupNode,
} from './dto/department.dto.js';

@Injectable()
export class DepartmentService {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly audit: AuditLogService,
    private readonly organizationGeneration: OrganizationGenerationService,
  ) {}

  async add(
    createDepartmentDto: CreateDepartmentDto,
    operatorId?: string,
    ip?: string,
  ) {
    try {
      const res = await this.departments.transaction(async (tx) => {
        const tag = await this.departments.create(
          { ...createDepartmentDto, path: '' },
          tx,
        );
        const path = await this.buildPath(
          tag.id,
          createDepartmentDto.parentId ?? null,
          tx,
        );
        return this.departments.updateById(tag.id, { path }, tx);
      });
      await this.audit.record({
        actorId: operatorId,
        action: AuditAction.DEPARTMENT_CREATE,
        resource: 'Department',
        resourceId: res.id,
        ip,
        metadata: {
          name: createDepartmentDto.name,
          parentId: createDepartmentDto.parentId,
        },
      });
      await this.organizationGeneration.bump();
      return { id: res.id, message: '添加部门成功' };
    } catch (error) {
      this.rethrowDuplicateName(error);
    }
  }

  async findAll() {
    const [list, total] = await Promise.all([
      this.departments.findRootTrees(),
      this.departments.count(),
    ]);
    if (!list?.length) throw new BadRequestException('部门列表为空');
    return { list, total, message: '获取部门列表成功' };
  }

  async lookup(): Promise<{
    list: DepartmentLookupNode[];
    total: number;
    message: string;
  }> {
    const [list, total] = await Promise.all([
      this.departments.findRootTrees(),
      this.departments.count(),
    ]);
    return {
      list: list.map((node) => this.toLookupNode(node)),
      total,
      message: '获取部门列表成功',
    };
  }

  private toLookupNode(node: {
    id: string;
    name: string;
    parentId: string | null;
    enabled: boolean;
    children?: unknown[];
  }): DepartmentLookupNode {
    return {
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      enabled: node.enabled,
      children: Array.isArray(node.children)
        ? node.children.map((child) =>
            this.toLookupNode(
              child as Parameters<DepartmentService['toLookupNode']>[0],
            ),
          )
        : [],
    };
  }

  async update(
    updateDepartmentDto: UpdateDepartmentDto,
    operatorId?: string,
    ip?: string,
  ) {
    const { id, parentId, ...rest } = updateDepartmentDto;
    try {
      const res = await this.departments.transaction(async (tx) => {
        const departments = await this.departments.findTreeLinks(tx);
        const current = departments.find((item) => item.id === id);
        if (!current) throw new BadRequestException('部门不存在');

        const nextParentId =
          parentId === undefined ? current.parentId : parentId;
        assertAcyclicParent(departments, id, nextParentId, '部门');

        const parent = nextParentId
          ? departments.find((item) => item.id === nextParentId)
          : null;
        const nextPath = parent ? `${parent.path}/${id}` : `/${id}`;

        const updated = await this.departments.updateById(
          id,
          {
            ...rest,
            ...(parentId === undefined ? {} : { parentId }),
            path: nextPath,
          },
          tx,
        );

        if (nextPath !== current.path) {
          await this.departments.replaceDescendantPaths(
            current.path,
            nextPath,
            tx,
          );
        }

        return updated;
      });
      await this.audit.record({
        actorId: operatorId,
        action: AuditAction.DEPARTMENT_UPDATE,
        resource: 'Department',
        resourceId: res.id,
        ip,
        metadata: { name: rest.name, parentId },
      });
      await this.organizationGeneration.bump();
      return { id: res.id, message: '更新部门成功' };
    } catch (error) {
      this.rethrowDuplicateName(error);
    }
  }

  async delete(id: string, operatorId?: string, ip?: string) {
    try {
      const deleted = await this.departments.transaction(async (tx) => {
        const department = await this.departments.lockById(id, tx);
        if (!department) return false;
        const child = await this.departments.findFirstChildId(id, tx);
        if (child) throw new BadRequestException('当前项有子部门无法删除');
        const references = await this.departments.findDeleteReferences(id, tx);
        if (references.customScope || references.customer) {
          const sources = [
            references.customScope ? 'CUSTOM_DEFINE 数据范围' : null,
            references.customer ? '客户' : null,
          ].filter(Boolean);
          throw new BadRequestException(
            `部门仍被${sources.join('、')}引用，无法删除`,
          );
        }
        await this.departments.deleteById(id, tx);
        return true;
      });
      if (!deleted) return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('部门仍被引用，无法删除');
      }
      throw error;
    }
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.DEPARTMENT_DELETE,
      resource: 'Department',
      resourceId: id,
      ip,
    });
    await this.organizationGeneration.bump();
    return { message: '删除部门成功' };
  }

  async generateDepartmentSeed(data: DepartmentSeedDto[]) {
    try {
      await this.departments.transaction(async (tx) => {
        for (const dept of data) {
          await this.upsertNode(tx, dept, null);
        }
      });
      await this.organizationGeneration.bump();
      return { message: '批量插入部门成功' };
    } catch (error) {
      this.rethrowDuplicateName(error);
    }
  }

  private async upsertNode(
    tx: Prisma.TransactionClient,
    node: DepartmentSeedDto,
    parentId: string | null,
  ) {
    const { name, enabled, description, children } = node;
    const tag = await this.departments.create(
      { name, enabled, description, path: '' },
      tx,
    );
    const path = await this.buildPath(tag.id, parentId, tx);
    await this.departments.updateById(tag.id, { path, parentId }, tx);

    if (children && children.length > 0) {
      for (const child of children) {
        await this.upsertNode(tx, child, tag.id);
      }
    }
  }

  private async buildPath(
    id: string,
    parentId: string | null,
    tx: Prisma.TransactionClient,
  ) {
    if (!parentId) return `/${id}`;
    const parent = await this.departments.findPathById(parentId, tx);
    if (!parent) throw new BadRequestException('父级不存在');
    return `${parent.path}/${id}`;
  }

  private rethrowDuplicateName(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('同级已存在同名部门');
    }
    throw error;
  }
}
