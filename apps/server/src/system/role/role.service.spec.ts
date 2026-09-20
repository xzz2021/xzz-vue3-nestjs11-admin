import type { PgService } from "#/prisma/pg.service.js";
import type { RbacPermissionCacheService } from "#/processor/rbac/index.js";
import { QueryRoleParams } from "./dto/role.dto.js";
import { RoleRepository } from "./role.repository.js";
import { ALWAYS_ACCESSIBLE_MENU_NAMES, RoleService } from "./role.service.js";

type MenuFindArgs = {
  where?: { name?: { in: string[] }; id?: { in: string[] } };
};

describe("RoleService seed and queries", () => {
  const roleFindMany = vi.fn();
  const roleCount = vi.fn();
  const roleFindUnique = vi.fn();
  const roleCreateMany = vi.fn();
  const roleUpsert = vi.fn();
  const menuFindMany = vi.fn();
  const roleMenuFindMany = vi.fn();
  const rolePermissionFindMany = vi.fn();
  const userFindUnique = vi.fn();
  const executeRaw = vi.fn();
  const transaction = vi.fn(
    async (
      callback: (tx: {
        role: {
          findMany: typeof roleFindMany;
          createMany: typeof roleCreateMany;
          upsert: typeof roleUpsert;
        };
        $executeRaw: typeof executeRaw;
      }) => Promise<unknown>,
    ) =>
      callback({
        role: {
          findMany: roleFindMany,
          createMany: roleCreateMany,
          upsert: roleUpsert,
        },
        $executeRaw: executeRaw,
      }),
  );

  const service = new RoleService(
    new RoleRepository({
      $transaction: transaction,
      $executeRaw: executeRaw,
      role: {
        findMany: roleFindMany,
        count: roleCount,
        findUnique: roleFindUnique,
        createMany: roleCreateMany,
        upsert: roleUpsert,
      },
      user: { findUnique: userFindUnique },
      menu: { findMany: menuFindMany },
      roleMenu: { findMany: roleMenuFindMany },
      rolePermission: { findMany: rolePermissionFindMany },
    }),
    {} as unknown as RbacPermissionCacheService,
    {
      record: vi.fn(),
    } as unknown as import("#/core/logger/audit-log.service.js").AuditLogService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    roleCreateMany.mockResolvedValue({ count: 1 });
    executeRaw.mockResolvedValue(1);
    roleUpsert.mockResolvedValue({});
    menuFindMany.mockResolvedValue([]);
  });

  const stubMenusByQuery = (
    byName: unknown[],
    byId: Record<string, unknown> = {},
  ) => {
    menuFindMany.mockImplementation((args: MenuFindArgs) => {
      if (args.where?.name) return byName;
      const ids = args.where?.id?.in ?? [];
      return ids.map((id) => byId[id]).filter(Boolean);
    });
  };

  const idMenuQueries = () =>
    menuFindMany.mock.calls.filter(
      (call) => (call[0] as MenuFindArgs)?.where?.id,
    );

  it("seeds roles with createMany and one update statement instead of looping upsert", async () => {
    roleFindMany.mockResolvedValue([{ code: "admin" }]);

    await service.generateRoleSeed([
      { code: "admin", name: "管理员", enabled: true, description: "all" },
      { code: "user", name: "用户", enabled: true, description: "user" },
    ]);

    expect(roleUpsert).not.toHaveBeenCalled();
    expect(roleCreateMany).toHaveBeenCalledTimes(1);
    expect(roleCreateMany).toHaveBeenCalledWith({
      data: [
        { code: "user", name: "用户", enabled: true, description: "user" },
      ],
    });
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const sql = executeRaw.mock.calls[0][0] as { sql: string };
    expect(sql.sql).toMatch(/UPDATE\s+"Role"/i);
  });

  it("loads role menus and permissions in parallel", async () => {
    let resolveMenus!: (value: unknown[]) => void;
    let resolveRoleMenus!: (value: unknown[]) => void;
    let resolveRolePermissions!: (value: unknown[]) => void;
    menuFindMany.mockReturnValue(
      new Promise((resolve) => {
        resolveMenus = resolve;
      }),
    );
    roleMenuFindMany.mockReturnValue(
      new Promise((resolve) => {
        resolveRoleMenus = resolve;
      }),
    );
    rolePermissionFindMany.mockReturnValue(
      new Promise((resolve) => {
        resolveRolePermissions = resolve;
      }),
    );

    const pending = service.getRoleMenuAndPerList("role-1");

    expect(menuFindMany).toHaveBeenCalled();
    expect(roleMenuFindMany).toHaveBeenCalled();
    expect(rolePermissionFindMany).toHaveBeenCalled();

    resolveMenus([]);
    resolveRoleMenus([]);
    resolveRolePermissions([]);
    await expect(pending).resolves.toEqual({
      list: [],
      message: "获取角色菜单及权限列表成功",
    });
  });

  it("loads assigned menus and permissions in parallel for a user", async () => {
    let resolveRoleMenus!: (value: unknown[]) => void;
    let resolveRolePermissions!: (value: unknown[]) => void;
    roleMenuFindMany.mockReturnValue(
      new Promise((resolve) => {
        resolveRoleMenus = resolve;
      }),
    );
    rolePermissionFindMany.mockReturnValue(
      new Promise((resolve) => {
        resolveRolePermissions = resolve;
      }),
    );

    const pending = service.getUserMenusWithPermissionCodes(["role-1"]);

    expect(roleMenuFindMany).toHaveBeenCalled();
    expect(rolePermissionFindMany).toHaveBeenCalled();
    expect(menuFindMany).toHaveBeenCalled();

    resolveRoleMenus([]);
    resolveRolePermissions([]);
    await expect(pending).resolves.toEqual([]);
  });

  it("injects allowlisted personal menus as hidden when the role did not assign them", async () => {
    roleMenuFindMany.mockResolvedValue([]);
    rolePermissionFindMany.mockResolvedValue([]);
    stubMenusByQuery(
      [
        {
          id: "menu-personal-center",
          parentId: "menu-personal",
          name: "PersonalCenter",
          path: "information",
          hidden: false,
          canTo: false,
        },
        {
          id: "menu-message",
          parentId: "menu-personal",
          name: "Message",
          path: "message",
          hidden: false,
          canTo: false,
        },
      ],
      {
        "menu-personal": {
          id: "menu-personal",
          parentId: null,
          name: "Personal",
          path: "personal",
          hidden: false,
          canTo: false,
          component: "#",
        },
      },
    );

    const result = await service.getUserMenusWithPermissionCodes(["role-1"]);

    expect(result.map((item) => item.name).sort()).toEqual([
      "Message",
      "Personal",
      "PersonalCenter",
    ]);
    expect(
      result.every((item) => item.hidden === true && item.canTo === true),
    ).toBe(true);
  });

  it("keeps assigned allowlisted menus visible in the sidebar", async () => {
    roleMenuFindMany.mockResolvedValue([
      {
        menu: {
          id: "menu-message",
          parentId: "menu-personal",
          name: "Message",
          path: "message",
          hidden: false,
          canTo: false,
        },
      },
    ]);
    rolePermissionFindMany.mockResolvedValue([]);
    stubMenusByQuery(
      [
        {
          id: "menu-personal-center",
          parentId: "menu-personal",
          name: "PersonalCenter",
          path: "information",
          hidden: false,
          canTo: false,
        },
        {
          id: "menu-message",
          parentId: "menu-personal",
          name: "Message",
          path: "message",
          hidden: false,
          canTo: false,
        },
      ],
      {
        "menu-personal": {
          id: "menu-personal",
          parentId: null,
          name: "Personal",
          path: "personal",
          hidden: false,
          canTo: false,
          component: "#",
        },
      },
    );

    const result = await service.getUserMenusWithPermissionCodes(["role-1"]);
    const byName = Object.fromEntries(result.map((item) => [item.name, item]));

    expect(byName.Message).toMatchObject({ hidden: false, canTo: false });
    expect(byName.Personal).toMatchObject({ hidden: false, canTo: false });
    expect(byName.PersonalCenter).toMatchObject({ hidden: true, canTo: true });
  });

  it("hydrates missing ancestor menus when only a leaf is assigned", async () => {
    roleMenuFindMany.mockResolvedValue([
      {
        menu: {
          id: "menu-role",
          parentId: "menu-auth",
          path: "role",
          name: "Role",
        },
      },
    ]);
    rolePermissionFindMany.mockResolvedValue([]);
    stubMenusByQuery([], {
      "menu-auth": {
        id: "menu-auth",
        parentId: null,
        path: "authorization",
        name: "Authorization",
        component: "#",
      },
    });

    const result = await service.getUserMenusWithPermissionCodes(["role-1"]);

    expect(result.map((item) => item.id).sort()).toEqual([
      "menu-auth",
      "menu-role",
    ]);
    expect(result.find((item) => item.id === "menu-auth")).toMatchObject({
      path: "authorization",
      permissions: [],
    });
    expect(menuFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["menu-auth"] }, enabled: true },
      }),
    );
  });

  it("walks multiple missing ancestor levels in one login payload", async () => {
    roleMenuFindMany.mockResolvedValue([
      {
        menu: {
          id: "menu-workplace",
          parentId: "menu-dashboard",
          path: "workplace",
          name: "Workplace",
        },
      },
    ]);
    rolePermissionFindMany.mockResolvedValue([]);
    stubMenusByQuery([], {
      "menu-dashboard": {
        id: "menu-dashboard",
        parentId: "menu-root",
        path: "dashboard",
        name: "Dashboard",
        component: "#",
      },
      "menu-root": {
        id: "menu-root",
        parentId: null,
        path: "app",
        name: "App",
        component: "#",
      },
    });

    const result = await service.getUserMenusWithPermissionCodes(["role-1"]);

    expect(result.map((item) => item.id).sort()).toEqual([
      "menu-dashboard",
      "menu-root",
      "menu-workplace",
    ]);
    expect(idMenuQueries()).toHaveLength(2);
  });

  it("does not query ancestors when parent menus are already assigned", async () => {
    roleMenuFindMany.mockResolvedValue([
      {
        menu: {
          id: "menu-auth",
          parentId: null,
          path: "authorization",
          name: "Authorization",
        },
      },
      {
        menu: {
          id: "menu-role",
          parentId: "menu-auth",
          path: "role",
          name: "Role",
        },
      },
    ]);
    rolePermissionFindMany.mockResolvedValue([]);

    const result = await service.getUserMenusWithPermissionCodes(["role-1"]);

    expect(result.map((item) => item.id).sort()).toEqual([
      "menu-auth",
      "menu-role",
    ]);
    expect(idMenuQueries()).toHaveLength(0);
    expect(menuFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          name: { in: [...ALWAYS_ACCESSIBLE_MENU_NAMES] },
          enabled: true,
        },
      }),
    );
  });

  it("throws when the role list is empty", async () => {
    roleFindMany.mockResolvedValue([]);
    roleCount.mockResolvedValue(0);

    await expect(
      service.getRoleList(
        QueryRoleParams.schema.parse({ pageIndex: 1, pageSize: 10 }),
      ),
    ).rejects.toThrow("角色列表数据为空");
  });

  it("reads creator name from the included user relation", async () => {
    roleFindUnique.mockResolvedValue({
      id: "role-1",
      name: "管理员",
      code: "admin",
      createdById: "user-1",
      createdBy: { id: "user-1", username: "admin" },
      _count: { users: 1, menus: 2, permissions: 3 },
    });

    const result = await service.getRoleDetail("role-1");

    expect(result.creatorName).toBe("admin");
    expect(result).not.toHaveProperty("createdBy");
    expect(userFindUnique).not.toHaveBeenCalled();
  });
});
