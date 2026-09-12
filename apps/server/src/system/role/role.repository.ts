import { Prisma } from '@/generated/prisma/client.js';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { Injectable } from '@nestjs/common';

type Db = PgService | Prisma.TransactionClient;
export interface RolePermissionSyncInput {
  permissionId: string;
  dataScope: Prisma.RolePermissionCreateInput['dataScope'];
  departmentIds: string[];
}
/*
按DDD分层原则 应该属于领域层 但是为了方便 还是放在了仓储层
引入Repository之后专注于数据库的可复用操作 而不用关心业务逻辑(Service负责)
*/
@Injectable()
export class RoleRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn);
  }

  findById(id: string, tx: Db = this.db) {
    return tx.role.findUnique({ where: { id } });
  }

  findByIdWithCounts(id: string) {
    return this.db.role.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            users: true,
            menus: true,
            permissions: true,
          },
        },
      },
    });
  }

  findByCode(code: string, tx: Db = this.db) {
    return tx.role.findUnique({ where: { code } });
  }

  findByIdCode(id: string, tx: Db = this.db) {
    return tx.role.findUnique({
      where: { id },
      select: { id: true, code: true },
    });
  }

  findPage(where: Prisma.RoleWhereInput, skip: number, take: number) {
    return Promise.all([
      this.db.role.findMany({
        skip,
        take,
        where,
        orderBy: { sort: 'asc' },
      }),
      this.db.role.count({ where }),
    ]);
  }

  findEnabledMenusWithPermissions() {
    return this.db.menu.findMany({
      where: { enabled: true },
      include: { permissions: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
  }

  findRoleMenuIds(roleId: string) {
    return this.db.roleMenu.findMany({
      where: { roleId },
      select: { menuId: true },
    });
  }

  findRolePermissionIds(roleId: string) {
    return this.db.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
  }

  findRolePermissionScopes(roleId: string) {
    return this.db.rolePermission.findMany({
      where: { roleId },
      select: {
        permissionId: true,
        dataScope: true,
        customDepartments: {
          select: {
            department: {
              select: { id: true, enabled: true },
            },
          },
          orderBy: { departmentId: 'asc' },
        },
      },
    });
  }

  findUserRoles(userId: string) {
    return this.db.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: { id: true, code: true },
        },
      },
    });
  }

  findEnabledMenusWithAllPermissions() {
    return this.db.menu.findMany({
      where: { enabled: true },
      include: { permissions: true },
    });
  }

  findMenusByRoleIds(roleIds: string[]) {
    return this.db.roleMenu.findMany({
      where: { roleId: { in: roleIds } },
      include: { menu: true },
    });
  }

  findPermissionsByRoleIds(roleIds: string[]) {
    return this.db.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });
  }

  findEnabledMenusByIds(ids: string[], tx: Db = this.db) {
    return tx.menu.findMany({
      where: { id: { in: ids }, enabled: true },
      select: { id: true },
    });
  }

  findEnabledMenus(ids: string[], tx: Db = this.db) {
    if (ids.length === 0) return Promise.resolve([]);
    return tx.menu.findMany({
      where: { id: { in: ids }, enabled: true },
    });
  }

  findEnabledMenusByNames(names: readonly string[], tx: Db = this.db) {
    if (names.length === 0) return Promise.resolve([]);
    return tx.menu.findMany({
      where: { name: { in: [...names] }, enabled: true },
    });
  }

  findEnabledPermissionsByIds(ids: string[], tx: Db = this.db) {
    return tx.permission.findMany({
      where: { id: { in: ids }, enabled: true },
      select: { id: true, menuId: true, scopeEnabled: true },
    });
  }

  findEnabledDepartmentsByIds(ids: string[], tx: Db = this.db) {
    return tx.department.findMany({
      where: { id: { in: ids }, enabled: true },
      select: { id: true },
    });
  }

  findUserIdsByRoleId(roleId: string, tx: Db = this.db) {
    return tx.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
  }

  findUserIdsByPermissionIds(
    permissionIds: string[],
    tx: Db = this.db,
  ): Promise<Array<{ userId: string }>> {
    const uniqueIds = [...new Set(permissionIds.filter(Boolean))];
    if (!uniqueIds.length) return Promise.resolve([]);
    return tx.userRole.findMany({
      where: {
        role: {
          permissions: { some: { permissionId: { in: uniqueIds } } },
        },
      },
      select: { userId: true },
    });
  }

  findCodes(codes: string[], tx: Db = this.db) {
    return tx.role.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
  }

  create(
    data: {
      name: string;
      code: string;
      enabled: boolean;
      description?: string | null;
      createdById?: string | null;
    },
    tx: Db = this.db,
  ) {
    return tx.role.create({
      data,
      select: { id: true },
    });
  }

  createMany(
    data: Array<{
      code: string;
      name: string;
      enabled?: boolean;
      description?: string | null;
    }>,
    tx: Db = this.db,
  ) {
    return tx.role.createMany({ data });
  }

  createMenus(roleId: string, menuIds: string[], tx: Db = this.db) {
    if (!menuIds.length) return;
    return tx.roleMenu.createMany({
      data: menuIds.map((menuId) => ({ roleId, menuId })),
    });
  }

  createPermissions(roleId: string, permissionIds: string[], tx: Db = this.db) {
    if (!permissionIds.length) return;
    return tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    });
  }

  updateById(id: string, data: Prisma.RoleUpdateInput, tx: Db = this.db) {
    return tx.role.update({ where: { id }, data, select: { id: true } });
  }

  async syncRoleMenus(roleId: string, menuIds: string[], tx: Db = this.db) {
    const current = await tx.roleMenu.findMany({
      where: { roleId },
      select: { menuId: true },
    });
    const wanted = new Set(menuIds);
    const currentIds = new Set(current.map((item) => item.menuId));
    const removed = current
      .filter((item) => !wanted.has(item.menuId))
      .map((item) => item.menuId);
    const added = menuIds.filter((menuId) => !currentIds.has(menuId));
    if (removed.length) {
      await tx.roleMenu.deleteMany({
        where: { roleId, menuId: { in: removed } },
      });
    }
    if (added.length) await this.createMenus(roleId, added, tx);
  }

  async syncRolePermissions(
    roleId: string,
    inputs: RolePermissionSyncInput[],
    tx: Db = this.db,
  ) {
    const current = await tx.rolePermission.findMany({
      where: { roleId },
      select: {
        id: true,
        permissionId: true,
        dataScope: true,
        customDepartments: { select: { departmentId: true } },
      },
    });
    const wanted = new Map(inputs.map((input) => [input.permissionId, input]));
    const removedIds = current
      .filter((item) => !wanted.has(item.permissionId))
      .map((item) => item.id);
    if (removedIds.length) {
      await tx.rolePermission.deleteMany({ where: { id: { in: removedIds } } });
    }

    const currentByPermission = new Map(
      current.map((item) => [item.permissionId, item]),
    );
    for (const input of inputs) {
      const existing = currentByPermission.get(input.permissionId);
      if (!existing) {
        const created = await tx.rolePermission.create({
          data: {
            roleId,
            permissionId: input.permissionId,
            dataScope: input.dataScope,
          },
          select: { id: true },
        });
        if (input.departmentIds.length) {
          await tx.rolePermissionDepartment.createMany({
            data: input.departmentIds.map((departmentId) => ({
              rolePermissionId: created.id,
              departmentId,
            })),
          });
        }
        continue;
      }

      const currentDepartments = existing.customDepartments
        .map((item) => item.departmentId)
        .sort();
      const nextDepartments = [...input.departmentIds].sort();
      const departmentsChanged =
        currentDepartments.length !== nextDepartments.length ||
        currentDepartments.some(
          (departmentId, index) => departmentId !== nextDepartments[index],
        );
      if (existing.dataScope !== input.dataScope) {
        await tx.rolePermission.update({
          where: { id: existing.id },
          data: { dataScope: input.dataScope },
        });
      }
      if (departmentsChanged || input.dataScope !== 'CUSTOM_DEFINE') {
        await tx.rolePermissionDepartment.deleteMany({
          where: { rolePermissionId: existing.id },
        });
        if (input.dataScope === 'CUSTOM_DEFINE' && input.departmentIds.length) {
          await tx.rolePermissionDepartment.createMany({
            data: input.departmentIds.map((departmentId) => ({
              rolePermissionId: existing.id,
              departmentId,
            })),
          });
        }
      }
    }
  }

  updateWithMenus(
    id: string,
    data: Prisma.RoleUpdateInput,
    menuIds: string[],
    permissionIds: string[],
    tx: Db = this.db,
  ) {
    return tx.role.update({
      where: { id },
      data: {
        ...data,
        menus: {
          deleteMany: {},
          ...(menuIds.length
            ? {
                create: menuIds.map((menuId) => ({
                  menu: { connect: { id: menuId } },
                })),
              }
            : {}),
        },
        permissions: {
          deleteMany: {},
          ...(permissionIds.length
            ? {
                create: permissionIds.map((permissionId) => ({
                  permission: { connect: { id: permissionId } },
                })),
              }
            : {}),
        },
      },
      select: { id: true },
    });
  }

  deleteById(id: string, tx: Db = this.db) {
    return tx.role.delete({
      where: { id },
      select: { id: true },
    });
  }

  deleteMenus(roleId: string, tx: Db = this.db) {
    return tx.roleMenu.deleteMany({ where: { roleId } });
  }

  deletePermissions(roleId: string, tx: Db = this.db) {
    return tx.rolePermission.deleteMany({ where: { roleId } });
  }

  executeRaw(sql: Prisma.Sql, tx: Db = this.db) {
    return tx.$executeRaw(sql);
  }
}
