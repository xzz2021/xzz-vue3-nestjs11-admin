import { RbacPermissionCacheService } from '#/processor/rbac/index.js';
import { RoleRepository } from '#/system/role/role.repository.js';
import { Injectable } from '@nestjs/common';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
} from './dto/permission.dto.js';
import { PermissionRepository } from './permission.repository.js';

@Injectable()
export class PermissionService {
  constructor(
    private readonly permissions: PermissionRepository,
    private readonly roles: RoleRepository,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
  ) {}

  async create(createPermissionDto: CreatePermissionDto) {
    const res = await this.permissions.create(createPermissionDto);
    return { id: res.id, message: '创建权限成功' };
  }

  async update(updatePermissionDto: UpdatePermissionDto) {
    const { id, ...rest } = updatePermissionDto;
    const result = await this.permissions.transaction(async (tx) => {
      const current = await this.permissions.findScopeState(id, tx);
      const users = await this.roles.findUserIdsByPermissionIds([id], tx);
      const permission = await this.permissions.updateById(id, rest, tx);
      if (current?.scopeEnabled && rest.scopeEnabled === false) {
        await this.permissions.clearCustomDepartments(id, tx);
        await this.permissions.clearDataScopes(id, tx);
      }
      return { permission, userIds: users.map((item) => item.userId) };
    });
    await this.rbacPermissionCache.invalidateUsers(result.userIds);
    return { id: result.permission.id, message: '更新权限成功' };
  }

  async remove(id: string) {
    const result = await this.permissions.transaction(async (tx) => {
      const users = await this.roles.findUserIdsByPermissionIds([id], tx);
      const permission = await this.permissions.deleteById(id, tx);
      return { permission, userIds: users.map((item) => item.userId) };
    });
    await this.rbacPermissionCache.invalidateUsers(result.userIds);
    return { id: result.permission.id, message: '删除权限成功' };
  }
}
