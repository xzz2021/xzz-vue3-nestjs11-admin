import {
  ALL_PERMISSIONS,
  SUPER_ADMIN_ROLE,
} from '@/processor/rbac/rbac-permission.js';
import { Injectable } from '@nestjs/common';
import { AuthorizationContext } from './authorization-context.js';
import type { AuthorizationSnapshot } from './authorization-snapshot.js';
import { AuthorizationSnapshotCacheService } from './authorization-snapshot-cache.service.js';
import {
  AuthorizationRepository,
  type AuthorizationPermissionSource,
} from './authorization.repository.js';
import { mergeGrants } from './scope-grant-strategy.registry.js';
import type { ScopeResolutionMemo } from './scope-resolver.interface.js';
import { ScopeResolverRegistry } from './scope-resolver.registry.js';
import type { AuthorizationDecision, ResolvedGrant } from './scope.types.js';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly repository: AuthorizationRepository,
    private readonly resolvers: ScopeResolverRegistry,
    private readonly cache: AuthorizationSnapshotCacheService,
  ) {}

  // 按用户 ID 取出（cache缓存）或算出 完整授权快照
  async createContext(
    userId: string,
    _requestedPermissionCodes: readonly string[],
  ): Promise<AuthorizationContext> {
    // requestedPermissionCodes 仅描述本次请求所需权限；缓存刻意保存用户完整快照，
    // 避免不同路由生成互不完整且无法安全复用的缓存条目。
    const snapshot = await this.cache.getOrLoad(userId, () =>
      this.buildSnapshot(userId),
    );
    // 返回AuthorizationContext 实例, 包含权限代码和决策  ( 当前用户    当前权限code    当前code下是否有scoped范围, 如果有则放入grant, 并且返回具体scopes[])
    return new AuthorizationContext(
      userId,
      snapshot.permissionCodes,
      snapshot.decisions,
    );
  }

  private async buildSnapshot(userId: string): Promise<AuthorizationSnapshot> {
    const source = await this.repository.loadUserAuthorization(userId);
    if (!source) return { permissionCodes: [], decisions: {} };

    const superAdmin = source.roles.some(
      (role) => role.code === SUPER_ADMIN_ROLE,
    );
    if (superAdmin) {
      return {
        permissionCodes: [ALL_PERMISSIONS],
        // 超级管理员放行所有细颗粒度权限 无范围限制    Object.fromEntries把一组 [key, value] 键值对转换成普通 JavaScript 对象
        decisions: Object.fromEntries(
          source.permissionCatalog.map((permission) => [
            permission.code,
            permission.scopeEnabled
              ? { scoped: true, grant: { all: true, scopes: [] } }
              : { scoped: false },
          ]),
        ),
      };
    }

    //  合并去重 权限code
    const permissionCodes = [
      ...new Set(
        source.roles.flatMap((role) =>
          role.permissions.map((permission) => permission.code),
        ),
      ),
    ].sort();
    const byCode = new Map<string, AuthorizationPermissionSource[]>();
    for (const role of source.roles) {
      for (const permission of role.permissions) {
        const existing = byCode.get(permission.code) ?? [];
        existing.push(permission);
        byCode.set(permission.code, existing);
      }
    }

    const decisions: Record<string, AuthorizationDecision> = {};
    const memo: ScopeResolutionMemo = { departmentSubtrees: new Map() };
    await Promise.all(
      [...byCode.entries()].map(async ([code, permissions]) => {
        // 开始归并细颗粒度权限
        decisions[code] = await this.resolveDecision(
          source.userId,
          source.departmentId,
          permissions,
          memo,
        );
      }),
    );
    return {
      permissionCodes,
      // decisions 用于 细颗粒度权限控制, 决定“这个用户能不能对这条数据做这件事”   //    decisions 按权限 code 排成稳定的键序后再放进快照
      decisions: Object.fromEntries(
        Object.entries(decisions).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    };
  }

  private async resolveDecision(
    userId: string,
    departmentId: string | null,
    permissions: AuthorizationPermissionSource[],
    memo: ScopeResolutionMemo,
  ): Promise<AuthorizationDecision> {
    if (!permissions[0]?.scopeEnabled) return { scoped: false };

    const grants: ResolvedGrant[] = await Promise.all(
      permissions.map((permission) => {
        //  当前权限项没有范围
        if (!permission.dataScope)
          return Promise.resolve({ all: false, scopes: [] });
        // 有范围则获取具体范围   { all: false, scopes: [{ type: 'SELF' }] } 或者  { all: false, scopes: [{ type: 'DEPARTMENT', ids: [input.departmentId] }] }  等等
        return this.resolvers.resolveGrant(permission.dataScope, {
          userId,
          departmentId,
          customDepartments: permission.customDepartments,
          memo,
        });
      }),
    );
    // 深度 递归?  合并所有范围    { all: false, scopes: [{ type: 'SELF' }, { type: 'DEPARTMENT', ids: [input.departmentId] }] }
    return { scoped: true, grant: mergeGrants(grants) };
  }
}
