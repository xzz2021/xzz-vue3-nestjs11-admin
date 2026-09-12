import { AuditAction } from '@/core/logger/audit-action.js';
import { AuditLogService } from '@/core/logger/audit-log.service.js';
import { Prisma } from '@/generated/prisma/client.js';
import type { AuthorizationContext } from '@/processor/authorization/authorization-context.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import {
  CUSTOMER_CSV_HEADER,
  CUSTOMER_EXPORT_BATCH_SIZE,
  CUSTOMER_EXPORT_MAX_ROWS,
  serializeCustomerCsvRow,
} from './customer.csv.js';
import { CustomerPolicy } from './customer.policy.js';
import { CustomerRepository, type CustomerRow } from './customer.repository.js';
import type {
  CreateCustomerDto,
  ExportCustomerDto,
  QueryCustomerDto,
  UpdateCustomerDto,
} from './dto/customer.dto.js';

const HIDDEN_MESSAGE = '数据无操作权限或不符合条件';

function sortedUniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

function decimalCents(value: { toString(): string } | string | number): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.toString());
  if (!match) throw new BadRequestException('金额格式不正确');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

@Injectable()
export class CustomerService {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: Partial<QueryCustomerDto>, context?: AuthorizationContext) {
    const policy = this.policy(context);
    const pageIndex = query.pageIndex ?? 1;
    const pageSize = query.pageSize ?? 20;
    // 合并权限过滤的where 和补充的 一般where条件
    const where = policy.queryWhere('customer:view', this.businessWhere(query));
    const [rows, total] = await this.customers.findPage(
      where,
      (pageIndex - 1) * pageSize,
      pageSize,
    );
    return {
      list: rows.map((row) => this.project(row, policy)),
      total,
      pageIndex,
      pageSize,
    };
  }

  async detail(id: string, context?: AuthorizationContext) {
    const policy = this.policy(context);
    const row = await this.customers.findFirst(
      policy.queryWhere('customer:detail', { id }),
    );
    if (!row) throw new ForbiddenException(HIDDEN_MESSAGE);
    return this.project(row, policy);
  }

  async create(
    dto: CreateCustomerDto,
    context?: AuthorizationContext,
    ip?: string,
  ) {
    this.policy(context);
    const actorId = context!.userId;
    const created = await this.customers.transaction(async (tx) => {
      const ownerId = dto.ownerId ?? actorId;
      const lockedUsers = await this.customers.lockUsersForShare(
        sortedUniqueIds([actorId, ownerId]),
        tx,
      );
      const usersById = new Map(lockedUsers.map((user) => [user.id, user]));
      const actor = usersById.get(actorId);
      if (!actor) throw new BadRequestException('当前用户不存在或已禁用');
      const departmentId = dto.departmentId ?? actor.departmentId;
      if (!departmentId) throw new BadRequestException('缺少有效目标部门');
      const [department] = await this.customers.lockDepartmentsForShare(
        [departmentId],
        tx,
      );

      const explicitAssignment =
        (dto.ownerId !== undefined && dto.ownerId !== actorId) ||
        (dto.departmentId !== undefined &&
          dto.departmentId !== actor.departmentId);
      if (explicitAssignment && !context!.hasPermission('customer:assign')) {
        throw new ForbiddenException('无权分配客户');
      }
      if (
        !this.matchesCreateGrant(
          context!,
          ownerId,
          departmentId,
          actor.departmentId,
        )
      ) {
        throw new ForbiddenException('目标超出可创建范围');
      }
      if (
        (dto.internalCost !== undefined && Number(dto.internalCost) !== 0) ||
        dto.confidential === true
      ) {
        if (!context!.hasPermission('customer:sensitive-update')) {
          throw new ForbiddenException('无权设置敏感字段');
        }
      }

      const owner = usersById.get(ownerId);
      if (!actor.enabled)
        throw new BadRequestException('当前用户不存在或已禁用');
      this.validateLockedAssignment(
        owner ?? null,
        department ?? null,
        departmentId,
      );
      return this.customers.create(
        {
          name: dto.name,
          phone: dto.phone ?? null,
          remark: dto.remark ?? null,
          status: dto.status,
          dealAmount: dto.dealAmount,
          internalCost: dto.internalCost,
          confidential: dto.confidential,
          ownerId,
          departmentId,
          createdById: actorId,
        },
        tx,
      );
    });
    await this.audit.record({
      actorId,
      action: AuditAction.CUSTOMER_CREATE,
      resource: 'Customer',
      resourceId: created.id,
      ip,
      metadata: { status: created.status, departmentId: created.departmentId },
    });
    return { id: created.id, message: '添加客户成功' };
  }

  async update(
    dto: UpdateCustomerDto,
    context?: AuthorizationContext,
    ip?: string,
  ) {
    const policy = this.policy(context);
    const { id, version, ...patch } = dto;
    await this.customers.transaction(async (tx) => {
      const policyWhere = policy.mutationWhere('customer:update', { id });
      const candidate = await this.customers.findFirst(policyWhere, tx);
      if (!candidate) throw new ForbiddenException(HIDDEN_MESSAGE);

      const candidateTargetOwnerId = patch.ownerId ?? candidate.ownerId;
      const candidateTargetDepartmentId =
        patch.departmentId ?? candidate.departmentId;
      const assignmentMayChange =
        candidateTargetOwnerId !== candidate.ownerId ||
        candidateTargetDepartmentId !== candidate.departmentId;
      const lockedUsers = assignmentMayChange
        ? await this.customers.lockUsersForShare(
            sortedUniqueIds([candidate.ownerId, candidateTargetOwnerId]),
            tx,
          )
        : [];
      const lockedDepartments = assignmentMayChange
        ? await this.customers.lockDepartmentsForShare(
            sortedUniqueIds([
              candidate.departmentId,
              candidateTargetDepartmentId,
            ]),
            tx,
          )
        : [];

      const locked = await this.customers.lockCustomerForUpdate(id, tx);
      if (!locked) throw new ForbiddenException(HIDDEN_MESSAGE);

      const current = await this.customers.findFirst(policyWhere, tx);
      if (!current || !policy.can('update', current))
        throw new ForbiddenException(HIDDEN_MESSAGE);
      if (current.version !== version)
        throw new ConflictException('数据已被其他请求修改');

      const next = { ...current, ...patch } as CustomerRow;
      if (!policy.can('update', next))
        throw new ForbiddenException('更新后的客户属性不允许操作');

      const assignmentChanged =
        (patch.ownerId !== undefined && patch.ownerId !== current.ownerId) ||
        (patch.departmentId !== undefined &&
          patch.departmentId !== current.departmentId);
      if (assignmentChanged) {
        const usersById = new Map(lockedUsers.map((user) => [user.id, user]));
        const departmentsById = new Map(
          lockedDepartments.map((department) => [department.id, department]),
        );
        if (
          !assignmentMayChange ||
          !usersById.has(current.ownerId) ||
          !usersById.has(next.ownerId) ||
          !departmentsById.has(current.departmentId) ||
          !departmentsById.has(next.departmentId)
        ) {
          throw new ConflictException('数据已被其他请求修改');
        }
        if (!context!.hasPermission('customer:assign'))
          throw new ForbiddenException('无权分配客户');
        if (
          !policy.targetMatchesGrant(
            'customer:update',
            next.ownerId,
            next.departmentId,
          )
        ) {
          throw new ForbiddenException('目标超出可更新范围');
        }
        this.validateLockedAssignment(
          usersById.get(next.ownerId) ?? null,
          departmentsById.get(next.departmentId) ?? null,
          next.departmentId,
        );
      }

      const internalCostChanged =
        patch.internalCost !== undefined &&
        decimalCents(patch.internalCost) !== decimalCents(current.internalCost);
      const confidentialChanged =
        patch.confidential !== undefined &&
        patch.confidential !== current.confidential;
      if (
        (internalCostChanged &&
          !policy.canUpdateSensitive(next, 'internalCost')) ||
        (confidentialChanged &&
          !policy.canUpdateSensitive(next, 'confidential'))
      ) {
        throw new ForbiddenException('无权更新敏感字段');
      }

      const result = await this.customers.updateMany(
        policy.mutationWhere('customer:update', { id, version }),
        {
          ...patch,
          version: { increment: 1 },
        },
        tx,
      );
      if (result.count === 0) {
        const stillOperable = await this.customers.findFirst(policyWhere, tx);
        if (stillOperable && policy.can('update', stillOperable)) {
          throw new ConflictException('数据已被其他请求修改');
        }
        throw new ForbiddenException(HIDDEN_MESSAGE);
      }
    });
    await this.audit.record({
      actorId: context!.userId,
      action: AuditAction.CUSTOMER_UPDATE,
      resource: 'Customer',
      resourceId: id,
      ip,
      metadata: { changedFields: Object.keys(patch).sort() },
    });
    return { id, message: '更新客户成功' };
  }

  async delete(ids: string[], context?: AuthorizationContext, ip?: string) {
    const policy = this.policy(context);
    const uniqueIds = [...new Set(ids)];
    await this.customers.transaction(async (tx) => {
      const where = policy.mutationWhere('customer:delete', {
        id: { in: uniqueIds },
      });
      const rows = await this.customers.findMany(where, tx);
      if (
        rows.length !== uniqueIds.length ||
        rows.some((row) => !policy.can('delete', row))
      ) {
        throw new ForbiddenException(HIDDEN_MESSAGE);
      }
      const deleted = await this.customers.deleteMany(where, tx);
      if (deleted.count !== uniqueIds.length)
        throw new ForbiddenException(HIDDEN_MESSAGE);
    });
    await this.audit.record({
      actorId: context!.userId,
      action: AuditAction.CUSTOMER_DELETE,
      resource: 'Customer',
      resourceId: uniqueIds.length === 1 ? uniqueIds[0] : undefined,
      ip,
      metadata: { count: uniqueIds.length },
    });
    return { count: uniqueIds.length, message: '删除客户成功' };
  }

  async export(
    query: Partial<ExportCustomerDto>,
    context?: AuthorizationContext,
    ip?: string,
  ): Promise<Readable> {
    const policy = await Promise.resolve(this.policy(context));
    const where = policy.queryWhere(
      'customer:export',
      this.businessWhere(query),
    );
    const actorId = context!.userId;
    const customers = this.customers;
    const audit = this.audit;
    let count = 0;
    let auditPromise: Promise<void> | undefined;
    const recordOutcome = (
      outcome: 'success' | 'failed' | 'aborted',
      errorCode?: 'CUSTOMER_EXPORT_READ_FAILED',
    ): Promise<void> => {
      auditPromise ??= Promise.resolve()
        .then(() =>
          audit.record({
            actorId,
            action: AuditAction.CUSTOMER_EXPORT,
            resource: 'Customer',
            success: outcome === 'success',
            ip,
            metadata: { outcome, count, ...(errorCode ? { errorCode } : {}) },
          }),
        )
        .catch(() => undefined);
      return auditPromise;
    };

    const stream = Readable.from(
      (async function* () {
        let cursor: string | undefined;
        let outcome: 'success' | 'failed' | 'aborted' = 'aborted';
        let errorCode: 'CUSTOMER_EXPORT_READ_FAILED' | undefined;
        try {
          yield `\uFEFF${CUSTOMER_CSV_HEADER}`;
          while (count < CUSTOMER_EXPORT_MAX_ROWS) {
            const take = Math.min(
              CUSTOMER_EXPORT_BATCH_SIZE,
              CUSTOMER_EXPORT_MAX_ROWS - count,
            );
            const batch = await customers.findExportBatch(where, cursor, take);
            if (batch.length === 0) break;
            for (const row of batch) {
              yield serializeCustomerCsvRow({
                ...row,
                internalCost: policy.canReadSensitive()
                  ? row.internalCost
                  : undefined,
              });
              count++;
            }
            cursor = batch.at(-1)!.id;
            if (batch.length < take) break;
          }
          outcome = 'success';
        } catch (error) {
          outcome = 'failed';
          errorCode = 'CUSTOMER_EXPORT_READ_FAILED';
          throw error;
        } finally {
          await recordOutcome(outcome, errorCode);
        }
      })(),
    );
    stream.once('close', () => {
      void recordOutcome('aborted');
    });
    return stream;
  }

  private policy(context?: AuthorizationContext): CustomerPolicy {
    if (!context) throw new ForbiddenException('授权上下文缺失');
    return new CustomerPolicy(context);
  }

  private businessWhere(
    query: Partial<ExportCustomerDto>,
  ): Prisma.CustomerWhereInput {
    const conditions: Prisma.CustomerWhereInput[] = [];
    if (query.keyword) {
      conditions.push({
        OR: [
          { name: { contains: query.keyword, mode: 'insensitive' } },
          { phone: { contains: query.keyword, mode: 'insensitive' } },
        ],
      });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.departmentId)
      conditions.push({ departmentId: query.departmentId });
    return conditions.length === 0 ? {} : { AND: conditions };
  }

  private validateLockedAssignment(
    owner: { enabled: boolean; departmentId: string | null } | null,
    department: { enabled: boolean } | null,
    departmentId: string,
  ) {
    if (!department?.enabled)
      throw new BadRequestException('目标部门不存在或已禁用');
    if (!owner?.enabled)
      throw new BadRequestException('目标负责人不存在或已禁用');
    if (owner.departmentId !== departmentId)
      throw new BadRequestException('负责人不属于目标部门');
  }

  private matchesCreateGrant(
    context: AuthorizationContext,
    ownerId: string,
    departmentId: string,
    actorDepartmentId: string | null,
  ): boolean {
    if (context.permissionCodes.has('*')) return true;
    const decision = context.decisionFor('customer:add');
    if (!decision?.scoped) return false;
    if (decision.grant.all) return true;
    return decision.grant.scopes.some((scope) =>
      scope.type === 'SELF'
        ? ownerId === context.userId &&
          actorDepartmentId !== null &&
          departmentId === actorDepartmentId
        : scope.ids.includes(departmentId),
    );
  }

  private project(row: CustomerRow, policy: CustomerPolicy) {
    const projected = policy.project(row);
    return {
      ...projected,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
