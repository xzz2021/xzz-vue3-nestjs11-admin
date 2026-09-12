import { AuditAction } from '#/core/logger/audit-action.js';
import { AuditLogService } from '#/core/logger/audit-log.service.js';
import { Prisma } from '#/generated/prisma/client.js';
import { RbacPermissionCacheService } from '#/processor/rbac/index.js';
import { uniqueBy } from '#/processor/utils/array.js';
import { listToTree } from '#/processor/utils/list2tree.util.js';
import { assertAcyclicParent } from '#/processor/utils/tree-cycle.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMenuDto, MenuSortDto, UpdateMenuDto } from './dto/menu.dto.js';
import { MenuRepository } from './menu.repository.js';
import { RoleRepository } from '#/system/role/role.repository.js';

@Injectable()
export class MenuService {
  constructor(
    private readonly menus: MenuRepository,
    private readonly audit: AuditLogService,
    private readonly roles: RoleRepository,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
  ) {}

  async create(createMenuDto: CreateMenuDto, operatorId?: string, ip?: string) {
    const { parentId, ...rest } = createMenuDto;
    const res = await this.menus.create({
      ...rest,
      parent: {
        connect: parentId ? { id: parentId } : undefined,
      },
    });
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.MENU_CREATE,
      resource: 'Menu',
      resourceId: res.id,
      ip,
      metadata: { name: rest.name, path: rest.path, type: rest.type, parentId },
    });

    return { id: res.id, message: '创建菜单成功' };
  }

  async update(updateMenuDto: UpdateMenuDto, operatorId?: string, ip?: string) {
    const { id, parentId, ...rest } = updateMenuDto;
    const res = await this.menus.transaction(async (tx) => {
      const links = await this.menus.findTreeLinks(tx);
      const current = links.find((item) => item.id === id);
      if (!current) throw new NotFoundException('菜单不存在');

      const nextParentId = parentId === undefined ? current.parentId : parentId;
      assertAcyclicParent(links, id, nextParentId, '菜单');

      const data: Prisma.MenuUpdateInput = {
        ...rest,
        ...(parentId === undefined
          ? {}
          : parentId === null
            ? { parent: { disconnect: true } }
            : { parent: { connect: { id: parentId } } }),
      };
      return this.menus.updateById(id, data, tx);
    });

    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.MENU_UPDATE,
      resource: 'Menu',
      resourceId: res?.id,
      ip,
      metadata: { name: rest.name, path: rest.path, parentId },
    });
    return { id: res?.id, message: '更新菜单成功' };
  }

  /**
   * 删除菜单（仅允许删除无子菜单的节点）。
   * Permission / RoleMenu / RolePermission 由数据库外键级联删除。
   */
  async remove(id: string, operatorId?: string, ip?: string) {
    const menu = await this.menus.findById(id);
    if (!menu) {
      throw new NotFoundException('菜单不存在');
    }

    const childCount = await this.menus.countChildren(id);
    if (childCount > 0) {
      throw new BadRequestException('该菜单存在子菜单，请先删除子菜单');
    }

    const result = await this.menus.transaction(async (tx) => {
      const permissions = await this.menus.findPermissionIds(id, tx);
      const users = await this.roles.findUserIdsByPermissionIds(
        permissions.map((permission) => permission.id),
        tx,
      );
      await this.menus.deleteById(id, tx);
      return { userIds: users.map((user) => user.userId) };
    });
    await this.rbacPermissionCache.invalidateUsers(result.userIds);
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.MENU_DELETE,
      resource: 'Menu',
      resourceId: id,
      ip,
      metadata: { name: menu.name, path: menu.path },
    });
    return { id, message: '删除菜单成功' };
  }

  async findMenuList() {
    const menus = await this.menus.findAllWithPermissions();
    const list = listToTree(menus);
    return { list, message: '获取菜单成功' };
  }

  async sortMenu(sortMenu: MenuSortDto[]) {
    const rows = uniqueBy(sortMenu, (item) => item.id).map((item) => ({
      id: item.id,
      value: item.sort ?? 0,
    }));
    if (rows.length === 0) return { message: '菜单排序成功' };

    await this.menus.updateSorts(rows);
    return { message: '菜单排序成功' };
  }
}
