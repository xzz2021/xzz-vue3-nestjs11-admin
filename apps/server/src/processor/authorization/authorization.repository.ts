import type { DataScope } from '#/generated/prisma/enums.js';
import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { Injectable } from '@nestjs/common';
import type { CustomDepartmentInput } from './scope-resolver.interface.js';

export interface AuthorizationPermissionSource {
  code: string;
  scopeEnabled: boolean;
  dataScope: DataScope | null;
  customDepartments: CustomDepartmentInput[];
}

export interface AuthorizationRoleSource {
  code: string;
  permissions: AuthorizationPermissionSource[];
}

export interface AuthorizationPermissionCatalogItem {
  code: string;
  scopeEnabled: boolean;
}

export interface AuthorizationSource {
  userId: string;
  departmentId: string | null;
  roles: AuthorizationRoleSource[];
  permissionCatalog: AuthorizationPermissionCatalogItem[];
}

@Injectable()
export class AuthorizationRepository {
  constructor(private readonly db: PgService) {}

  async loadUserAuthorization(
    userId: string,
  ): Promise<AuthorizationSource | null> {
    const [user, permissionCatalog] = await Promise.all([
      this.db.user.findUnique({
        where: { id: userId, enabled: true },
        select: {
          id: true,
          department: {
            select: { id: true, enabled: true },
          },
          roles: {
            where: { role: { enabled: true } },
            select: {
              role: {
                select: {
                  code: true,
                  permissions: {
                    where: { permission: { enabled: true } },
                    select: {
                      dataScope: true,
                      permission: {
                        select: { code: true, scopeEnabled: true },
                      },
                      customDepartments: {
                        select: {
                          department: {
                            select: { id: true, enabled: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      //  这里是查出所有权限码 为什么???---> 后续给超级管理员放行所有细颗粒度权限 无范围限制
      this.db.permission.findMany({
        where: { enabled: true },
        select: { code: true, scopeEnabled: true },
        orderBy: { code: 'asc' },
      }),
    ]);
    if (!user) return null;

    return {
      userId: user.id,
      departmentId: user.department?.enabled ? user.department.id : null,
      permissionCatalog, //汇总多个角色 以及权限码
      roles: user.roles.map(({ role }) => ({
        code: role.code,
        permissions: role.permissions.map((item) => ({
          code: item.permission.code,
          scopeEnabled: item.permission.scopeEnabled,
          dataScope: item.dataScope,
          customDepartments: item.customDepartments.map(
            ({ department }) => department,
          ),
        })),
      })),
    };
  }
}
