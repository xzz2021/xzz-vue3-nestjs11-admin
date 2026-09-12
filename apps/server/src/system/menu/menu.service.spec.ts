import { MenuType } from "@prisma/generated/zod/enums";
import type { PgService } from "#/prisma/pg.service.js";
import { MenuRepository } from "./menu.repository.js";
import { MenuService } from "./menu.service.js";

describe("MenuService tree updates", () => {
  const findMany = jest.fn();
  const update = jest.fn();
  const executeRaw = jest.fn();
  const transaction = jest.fn(
    async (
      callback: (tx: {
        menu: { findMany: typeof findMany; update: typeof update };
        $executeRaw: typeof executeRaw;
      }) => Promise<unknown>,
    ) => callback({ menu: { findMany, update }, $executeRaw: executeRaw }),
  );

  const service = new MenuService(
    new MenuRepository({ $transaction: transaction }),
    {
      record: jest.fn(),
    } as unknown as import("#/core/logger/audit-log.service.js").AuditLogService,
    {} as import("#/system/role/role.repository.js").RoleRepository,
    {
      invalidateUsers: jest.fn(),
    } as unknown as import("#/processor/rbac/index.js").RbacPermissionCacheService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    update.mockResolvedValue({ id: "menu-1" });
    executeRaw.mockResolvedValue(2);
    findMany.mockResolvedValue([
      { id: "menu-1", parentId: "root" },
      { id: "child", parentId: "menu-1" },
      { id: "root", parentId: null },
    ]);
  });

  it("preserves the current parent when parentId is omitted", async () => {
    await service.update({
      id: "menu-1",
      name: "Menu",
      path: "menu",
      type: MenuType.MENU,
      sort: 0,
      enabled: true,
      title: "Menu",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "menu-1" },
        data: expect.not.objectContaining({ parent: expect.anything() }),
      }),
    );
  });

  it("rejects moving a menu under its descendant", async () => {
    await expect(
      service.update({
        id: "menu-1",
        parentId: "child",
        name: "Menu",
        path: "menu",
        type: MenuType.MENU,
        sort: 0,
        enabled: true,
        title: "Menu",
      }),
    ).rejects.toThrow("不能将菜单移动到自己的后代节点下");
    expect(update).not.toHaveBeenCalled();
  });

  it("sorts menus with one SQL statement instead of per-row updates", async () => {
    await service.sortMenu([
      { id: "menu-1", sort: 2 },
      { id: "child", sort: 1 },
    ]);

    expect(update).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const sql = executeRaw.mock.calls[0][0] as {
      sql: string;
      values: unknown[];
    };
    expect(sql.sql).toMatch(/UPDATE\s+"Menu"/i);
    expect(sql.values).toEqual(
      expect.arrayContaining(["menu-1", 2, "child", 1]),
    );
  });
});

describe("MenuService delete rules", () => {
  const findUnique = jest.fn();
  const count = jest.fn();
  const remove = jest.fn();
  const permissionFindMany = jest.fn();
  const findUserIdsByPermissionIds = jest.fn();
  const invalidateUsers = jest.fn();
  const transaction = jest.fn((callback) =>
    callback({
      menu: { delete: remove },
      permission: { findMany: permissionFindMany },
    }),
  );
  const service = new MenuService(
    new MenuRepository({
      $transaction: transaction,
      menu: { findUnique, count, delete: remove },
    }),
    {
      record: jest.fn(),
    } as unknown as import("#/core/logger/audit-log.service.js").AuditLogService,
    {
      findUserIdsByPermissionIds,
    } as unknown as import("#/system/role/role.repository.js").RoleRepository,
    {
      invalidateUsers,
    } as unknown as import("#/processor/rbac/index.js").RbacPermissionCacheService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    permissionFindMany.mockResolvedValue([{ id: "permission-1" }]);
    findUserIdsByPermissionIds.mockResolvedValue([{ userId: "user-1" }]);
    remove.mockResolvedValue({ id: "menu-1" });
  });

  it("refuses to delete a menu that still has children", async () => {
    findUnique.mockResolvedValue({ id: "menu-1" });
    count.mockResolvedValue(1);

    await expect(service.remove("menu-1")).rejects.toThrow(
      "该菜单存在子菜单，请先删除子菜单",
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it("invalidates affected users only after a successful cascading delete", async () => {
    findUnique.mockResolvedValue({ id: "menu-1", name: "菜单", path: "/menu" });
    count.mockResolvedValue(0);
    const order: string[] = [];
    remove.mockImplementation(() => {
      order.push("delete");
      return Promise.resolve({ id: "menu-1" });
    });
    invalidateUsers.mockImplementation(() => {
      order.push("invalidate");
      return Promise.resolve();
    });

    await service.remove("menu-1");

    expect(findUserIdsByPermissionIds).toHaveBeenCalledWith(
      ["permission-1"],
      expect.anything(),
    );
    expect(order).toEqual(["delete", "invalidate"]);
  });

  it("does not invalidate users when menu deletion fails", async () => {
    findUnique.mockResolvedValue({ id: "menu-1", name: "菜单", path: "/menu" });
    count.mockResolvedValue(0);
    remove.mockRejectedValueOnce(new Error("db failed"));

    await expect(service.remove("menu-1")).rejects.toThrow("db failed");
    expect(invalidateUsers).not.toHaveBeenCalled();
  });
});
