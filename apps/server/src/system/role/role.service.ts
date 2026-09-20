import { AuditAction } from '#/core/logger/audit-action.js';
import { AuditLogService } from '#/core/logger/audit-log.service.js';
import { Prisma, type Menu } from '#/generated/prisma/client.js';
import { DataScope } from '#/generated/prisma/enums.js';
import { RbacPermissionCacheService } from '#/processor/rbac/index.js';
import { uniqueBy } from '#/processor/utils/array.js';
import { listToTree } from '#/processor/utils/list2tree.util.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateRoleDto,
  QueryRoleParams,
  RoleSeedDto,
  UpdateRoleDto,
} from './dto/role.dto.js';
import { RolePermissionSyncInput, RoleRepository } from './role.repository.js';

// 登录时始终注入：未勾选则 hidden+canTo（顶栏可进、侧栏不显示）；勾选后沿用菜单表配置，侧栏可显示。
export const ALWAYS_ACCESSIBLE_MENU_NAMES = [
  'Workplace',
  'Personal',
  'PersonalCenter',
  'Message',
] as const;

@Injectable()
export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
    private readonly audit: AuditLogService,
  ) {}

  private buildMenuPermissionData(menus: CreateRoleDto['menus']) {
    const menuMap = new Map<string, Set<string>>();
    const scopeMap = new Map<
      string,
      { menuId: string; dataScope: DataScope; departmentIds?: string[] }
    >();
    for (const item of menus) {
      const permissionSet = menuMap.get(item.id) ?? new Set<string>();
      for (const permissionId of item.permissionIds) {
        permissionSet.add(permissionId);
      }
      for (const scope of item.permissionScopes ?? []) {
        if (!permissionSet.has(scope.permissionId)) {
          throw new BadRequestException(
            `权限 ${scope.permissionId} 必须先勾选（且位于同一菜单）`,
          );
        }
        if (scopeMap.has(scope.permissionId)) {
          throw new BadRequestException(
            `权限 ${scope.permissionId} 存在重复数据范围配置`,
          );
        }
        scopeMap.set(scope.permissionId, { menuId: item.id, ...scope });
      }
      menuMap.set(item.id, permissionSet);
    }
    const menuIds = [...menuMap.keys()];
    const permissionIds = [
      ...new Set([...menuMap.values()].flatMap((item) => [...item])),
    ];
    return { menuMap, scopeMap, menuIds, permissionIds };
  }

  private async validateMenuPermissions(
    menuMap: Map<string, Set<string>>,
    menuIds: string[],
    permissionIds: string[],
    scopeMap: Map<
      string,
      { menuId: string; dataScope: DataScope; departmentIds?: string[] }
    >,
    tx: Prisma.TransactionClient,
  ): Promise<RolePermissionSyncInput[]> {
    const [menus, permissions] = await Promise.all([
      this.roles.findEnabledMenusByIds(menuIds, tx),
      this.roles.findEnabledPermissionsByIds(permissionIds, tx),
    ]);
    if (menus.length !== menuIds.length)
      throw new BadRequestException('存在无效或被禁用的菜单');

    if (!permissionIds.length) return [];

    if (permissions.length !== permissionIds.length)
      throw new BadRequestException('存在无效或被禁用的权限');

    const permissionMenuMap = new Map<string, string>();
    for (const permission of permissions) {
      permissionMenuMap.set(permission.id, permission.menuId);
    }
    for (const [menuId, permissionSet] of menuMap) {
      for (const permissionId of permissionSet) {
        const permissionMenuId = permissionMenuMap.get(permissionId);
        if (permissionMenuId !== menuId) {
          throw new BadRequestException(
            `权限 ${permissionId} 不属于菜单 ${menuId}`,
          );
        }
      }
    }

    const departmentIds = new Set<string>();
    const normalized = permissions.map((permission) => {
      const scope = scopeMap.get(permission.id);
      if (!permission.scopeEnabled) {
        if (scope)
          throw new BadRequestException(
            `权限 ${permission.id} 未启用数据范围，不能提交 scope`,
          );
        return {
          permissionId: permission.id,
          dataScope: null,
          departmentIds: [],
        };
      }
      if (!scope)
        throw new BadRequestException(
          `权限 ${permission.id} 必须提交明确的数据范围`,
        );
      if (scope.menuId !== permission.menuId) {
        throw new BadRequestException(
          `权限 ${permission.id} 的数据范围不属于菜单 ${scope.menuId}`,
        );
      }
      const departments = scope.departmentIds ?? [];
      if (scope.dataScope === DataScope.CUSTOM_DEFINE) {
        if (!departments.length)
          throw new BadRequestException(
            `权限 ${permission.id} 的 CUSTOM_DEFINE 范围至少选择一个部门`,
          );
        departments.forEach((departmentId) => departmentIds.add(departmentId));
      } else if (scope.departmentIds !== undefined) {
        throw new BadRequestException(
          `仅 CUSTOM_DEFINE 数据范围允许提交 departmentIds`,
        );
      }
      return {
        permissionId: permission.id,
        dataScope: scope.dataScope,
        departmentIds: departments,
      };
    });

    if (departmentIds.size) {
      const departments = await this.roles.findEnabledDepartmentsByIds(
        [...departmentIds],
        tx,
      );
      if (departments.length !== departmentIds.size) {
        throw new BadRequestException(
          'CUSTOM_DEFINE 数据范围包含不存在或已禁用的部门',
        );
      }
    }
    return normalized;
  }

  async createRoleInfo(dto: CreateRoleDto, createdById?: string, ip?: string) {
    const { menuMap, scopeMap, menuIds, permissionIds } =
      this.buildMenuPermissionData(dto.menus);
    const res = await this.roles.transaction(async (tx) => {
      const existRole = await this.roles.findByCode(dto.code, tx);
      if (existRole) throw new BadRequestException('角色编码已存在');
      const permissionScopes = await this.validateMenuPermissions(
        menuMap,
        menuIds,
        permissionIds,
        scopeMap,
        tx,
      );
      const role = await this.roles.create(
        {
          name: dto.name,
          code: dto.code,
          enabled: dto.enabled ?? true,
          description: dto.description,
          createdById: createdById ?? null,
        },
        tx,
      );
      await this.roles.createMenus(role.id, menuIds, tx);
      await this.roles.syncRolePermissions(role.id, permissionScopes, tx);
      return role;
    });
    await this.audit.record({
      actorId: createdById,
      action: AuditAction.ROLE_CREATE,
      resource: 'Role',
      resourceId: res.id,
      ip,
      metadata: {
        name: dto.name,
        code: dto.code,
        enabled: dto.enabled ?? true,
        scopes: this.scopeAuditSummary(dto.menus),
      },
    });
    return { message: '创建角色成功', id: res.id };
  }

  async getRoleDetail(id: string) {
    const role = await this.roles.findByIdWithCounts(id);
    if (!role) throw new BadRequestException('角色不存在');

    const { _count, createdBy, ...roleInfo } = role;
    return {
      ...roleInfo,
      creatorName: createdBy?.username || '-',
      menuCount: _count.menus,
      permissionCount: _count.permissions,
      userCount: _count.users,
      message: '获取角色详情成功',
    };
  }

  // 管理模块 获取角色列表 用于展示
  async getRoleList(searchParam: QueryRoleParams) {
    const { pageIndex = 1, pageSize = 10, keyword, enabled } = searchParam;
    const skip = (pageIndex - 1) * pageSize;
    const take = pageSize;
    const keywordText = keyword?.trim();
    const where = {
      ...(keywordText
        ? {
            OR: [
              { name: { contains: keywordText } },
              { code: { contains: keywordText } },
            ],
          }
        : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    };

    const [list, total] = await this.roles.findPage(where, skip, take);
    if (!list?.length) throw new BadRequestException('角色列表数据为空');
    return { list, total, message: '获取角色列表成功' };
  }

  // 管理模块 获取指定角色菜单及对应拥有的权限列表,用于回显
  async getRoleMenuAndPerList(id: string) {
    // 如果id== "__new__" 说明是新增角色 则直接查出所有菜单和权限
    if (id === '__new__') {
      const list = await this.roles.findEnabledMenusWithPermissions();
      const nodes = list.map((menu) => {
        return {
          ...menu,
          checked: false,
          permissions: menu.permissions.map((permission) => {
            return {
              ...permission,
              checked: false,
              dataScope: null,
              departmentIds: [],
              disabledDepartmentIds: [],
            };
          }),
          children: [],
        };
      });
      return { list: listToTree(nodes), message: '获取角色菜单及权限列表成功' };
    }
    const [menus, roleMenus, rolePermissions] = await Promise.all([
      this.roles.findEnabledMenusWithPermissions(),
      this.roles.findRoleMenuIds(id),
      this.roles.findRolePermissionScopes(id),
    ]);
    const menuSet = new Set(roleMenus.map((i) => i.menuId));
    const permissionMap = new Map(
      rolePermissions.map((item) => [item.permissionId, item]),
    );
    const nodes = menus.map((menu) => {
      return {
        ...menu,
        checked: menuSet.has(menu.id),
        permissions: menu.permissions.map((permission) => {
          const assignment = permissionMap.get(permission.id);
          return {
            ...permission,
            checked: Boolean(assignment) && permission.enabled,
            dataScope: assignment?.dataScope ?? null,
            departmentIds:
              assignment?.customDepartments.map((item) => item.department.id) ??
              [],
            disabledDepartmentIds:
              assignment?.customDepartments
                .filter((item) => !item.department.enabled)
                .map((item) => item.department.id) ?? [],
          };
        }),
        children: [],
      };
    });
    return { list: listToTree(nodes), message: '获取角色菜单及权限列表成功' };
  }

  //  登录瞬间获取菜单表和对应的权限值字符串数组
  async findRoleMenu(userid: string) {
    //  通过userid查询当前用户角色是否其中之一是super_admin
    const users = await this.roles.findUserRoles(userid);
    if (users.some((u) => u.role.code === 'super_admin')) {
      return {
        list: await this.getRoleMenuWithPermissionOfAdmin(),
        message: '获取用户菜单成功',
      };
    }
    const roleIds = users.map((u) => u.role.id);

    const list = await this.getUserMenusWithPermissionCodes(roleIds);
    if (list.length === 0) {
      return { list, message: '请联系管理员分配角色菜单' };
    }

    return { list, message: '获取用户菜单成功' };
  }

  private async hydrateAncestorMenus(menus: Menu[]): Promise<Menu[]> {
    const byId = new Map<string, Menu>(menus.map((menu) => [menu.id, menu]));
    const missing = new Set<string>();
    for (const menu of menus) {
      if (menu.parentId && !byId.has(menu.parentId)) {
        missing.add(menu.parentId);
      }
    }
    while (missing.size) {
      const parents = await this.roles.findEnabledMenus([...missing]);
      missing.clear();
      for (const parent of parents) {
        if (byId.has(parent.id)) continue;
        byId.set(parent.id, parent);
        if (parent.parentId && !byId.has(parent.parentId)) {
          missing.add(parent.parentId);
        }
      }
    }
    return [...byId.values()];
  }

  // 获取全部菜单及对应权限
  async getRoleMenuWithPermissionOfAdmin() {
    const roleWithMenusAndPermissions =
      await this.roles.findEnabledMenusWithAllPermissions();
    if (
      !roleWithMenusAndPermissions ||
      roleWithMenusAndPermissions.length === 0
    ) {
      return [];
    }
    // 整理权限码数组到每个菜单的 meta.permissions
    const result = roleWithMenusAndPermissions.map((menu) => {
      const { permissions, ...rest } = menu;
      const permissionCodes = permissions.map((p) => p.code);

      return {
        ...rest,
        permissions: permissionCodes,
      };
    });
    return result;
  }

  async getUserMenusWithPermissionCodes(roleIds: string[]) {
    if (roleIds.length === 0) return [];
    const [roleMenus, rolePermissions, alwaysMenus] = await Promise.all([
      this.roles.findMenusByRoleIds(roleIds),
      this.roles.findPermissionsByRoleIds(roleIds),
      this.roles.findEnabledMenusByNames(ALWAYS_ACCESSIBLE_MENU_NAMES),
    ]);
    const assigned = uniqueBy(
      roleMenus.map((r) => r.menu),
      (menu) => menu.id,
    );
    const assignedTree = await this.hydrateAncestorMenus(assigned);
    const assignedTreeIds = new Set(assignedTree.map((menu) => menu.id));
    const menus = await this.hydrateAncestorMenus(
      uniqueBy([...assignedTree, ...alwaysMenus], (menu) => menu.id),
    );
    const permissions = uniqueBy(
      rolePermissions.map((r) => r.permission),
      (permission) => permission.code,
    );

    // 4) 把 permission.code 注入到对应菜单的 meta 里
    // extra：白名单注入、且不在「已勾选 + 勾选链路祖先」中 → 侧栏隐藏但仍可跳转
    const shaped = menus.map((m) => {
      const codes = permissions
        .filter((p) => p.menuId === m.id)
        .map((p) => p.code);
      const extra = !assignedTreeIds.has(m.id);
      return {
        ...m,
        permissions: codes,
        ...(extra ? { hidden: true, canTo: true } : {}),
      };
    });

    return shaped;
  }

  async update(dto: UpdateRoleDto, operatorId?: string, ip?: string) {
    const { id, menus, ...rest } = dto;
    const { menuMap, scopeMap, menuIds, permissionIds } =
      this.buildMenuPermissionData(menus);
    const res = await this.roles.transaction(async (tx) => {
      const existRole = await this.roles.findByIdCode(id, tx);
      if (!existRole) throw new BadRequestException('角色不存在');

      if (rest.code && rest.code !== existRole.code) {
        const codeUsed = await this.roles.findByCode(rest.code, tx);
        if (codeUsed) throw new BadRequestException('角色编码已存在');
      }

      const permissionScopes = await this.validateMenuPermissions(
        menuMap,
        menuIds,
        permissionIds,
        scopeMap,
        tx,
      );
      const role = await this.roles.updateById(id, rest, tx);
      await this.roles.syncRoleMenus(id, menuIds, tx);
      await this.roles.syncRolePermissions(id, permissionScopes, tx);
      return role;
    });
    const users = await this.roles.findUserIdsByRoleId(id);
    await this.rbacPermissionCache.invalidateUsers(
      users.map((item) => item.userId),
    );
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.ROLE_UPDATE,
      resource: 'Role',
      resourceId: res.id,
      ip,
      metadata: {
        name: rest.name,
        code: rest.code,
        enabled: rest.enabled,
        scopes: this.scopeAuditSummary(menus),
      },
    });
    return { id: res.id, message: '更新角色成功' };
  }

  async remove(id: string, operatorId?: string, ip?: string) {
    const res = await this.roles.transaction(async (tx) => {
      const users = await this.roles.findUserIdsByRoleId(id, tx);
      const role = await this.roles.deleteById(id, tx);
      await this.roles.deleteMenus(id, tx);
      await this.roles.deletePermissions(id, tx);
      return { role, userIds: users.map((item) => item.userId) };
    });
    await this.rbacPermissionCache.invalidateUsers(res.userIds);
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.ROLE_DELETE,
      resource: 'Role',
      resourceId: res.role.id,
      ip,
    });
    return { id: res.role.id, message: '删除角色成功' };
  }

  private scopeAuditSummary(menus: CreateRoleDto['menus']) {
    return menus.flatMap((menu) =>
      (menu.permissionScopes ?? []).map((scope) => ({
        permissionId: scope.permissionId,
        dataScope: scope.dataScope,
        departmentCount: scope.departmentIds?.length ?? 0,
      })),
    );
  }
}
