import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { RbacPermissionCacheService } from '#/processor/rbac/index.js';
import { RoleRepository } from '#/system/role/role.repository.js';
import { Injectable } from '@nestjs/common';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
} from './dto/permission.dto.js';

@Injectable()
export class PermissionService {
  constructor(
    private readonly pgService: PgService,
    private readonly roles: RoleRepository,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
  ) {}

  async create(createPermissionDto: CreatePermissionDto) {
    const res = await this.pgService.permission.create({
      data: createPermissionDto,
      select: { id: true },
    });
    return { id: res.id, message: '创建权限成功' };
  }

  async update(updatePermissionDto: UpdatePermissionDto) {
    const { id, ...rest } = updatePermissionDto;
    const result = await this.pgService.$transaction(async (tx) => {
      const current = await tx.permission.findUnique({
        where: { id },
        select: { id: true, scopeEnabled: true },
      });
      const users = await this.roles.findUserIdsByPermissionIds([id], tx);
      const permission = await tx.permission.update({
        where: { id },
        data: rest,
        select: { id: true },
      });
      if (current?.scopeEnabled && rest.scopeEnabled === false) {
        await tx.rolePermissionDepartment.deleteMany({
          where: { rolePermission: { permissionId: id } },
        });
        await tx.rolePermission.updateMany({
          where: { permissionId: id },
          data: { dataScope: null },
        });
      }
      return { permission, userIds: users.map((item) => item.userId) };
    });
    await this.rbacPermissionCache.invalidateUsers(result.userIds);
    return { id: result.permission.id, message: '更新权限成功' };
  }

  async remove(id: string) {
    const result = await this.pgService.$transaction(async (tx) => {
      const users = await this.roles.findUserIdsByPermissionIds([id], tx);
      const permission = await tx.permission.delete({
        where: { id },
        select: { id: true },
      });
      return { permission, userIds: users.map((item) => item.userId) };
    });
    await this.rbacPermissionCache.invalidateUsers(result.userIds);
    return { id: result.permission.id, message: '删除权限成功' };
  }
}
