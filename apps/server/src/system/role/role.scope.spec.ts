import { DataScope } from "#/prisma/generated/prisma/enums.js";
import { BadRequestException } from "@nestjs/common";
import type { RoleRepository } from "./role.repository.js";
import { RoleService } from "./role.service.js";

describe("RoleService data scopes", () => {
  const tx = {};
  const roles = {
    transaction: vi.fn((callback) => callback(tx)),
    findByCode: vi.fn(),
    findByIdCode: vi.fn(),
    findEnabledMenusByIds: vi.fn(),
    findEnabledPermissionsByIds: vi.fn(),
    findEnabledDepartmentsByIds: vi.fn(),
    create: vi.fn(),
    createMenus: vi.fn(),
    syncRolePermissions: vi.fn(),
    syncRoleMenus: vi.fn(),
    updateById: vi.fn(),
    findUserIdsByRoleId: vi.fn(),
    findEnabledMenusWithPermissions: vi.fn(),
    findRoleMenuIds: vi.fn(),
    findRolePermissionScopes: vi.fn(),
  };
  const cache = { invalidateUsers: vi.fn() };
  const audit = { record: vi.fn() };
  const service = new RoleService(
    roles as unknown as RoleRepository,
    cache as unknown as import("#/processor/rbac/index.js").RbacPermissionCacheService,
    audit as unknown as import("#/core/logger/audit-log.service.js").AuditLogService,
  );

  const dto = (
    permissionScopes?: Array<{
      permissionId: string;
      dataScope: DataScope;
      departmentIds?: string[];
    }>,
  ) => ({
    name: "销售",
    code: "sales",
    enabled: true,
    menus: [
      { id: "menu-1", permissionIds: ["permission-1"], permissionScopes },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    roles.findByCode.mockResolvedValue(null);
    roles.findEnabledMenusByIds.mockResolvedValue([{ id: "menu-1" }]);
    roles.findEnabledPermissionsByIds.mockResolvedValue([
      { id: "permission-1", menuId: "menu-1", scopeEnabled: true },
    ]);
    roles.findEnabledDepartmentsByIds.mockResolvedValue([]);
    roles.create.mockResolvedValue({ id: "role-1" });
    roles.updateById.mockResolvedValue({ id: "role-1" });
    roles.findUserIdsByRoleId.mockResolvedValue([{ userId: "user-1" }]);
  });

  it("requires an explicit scope for scope-enabled permissions", async () => {
    await expect(service.createRoleInfo(dto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(roles.create).not.toHaveBeenCalled();
  });

  it("rejects a scope for scope-disabled permissions", async () => {
    roles.findEnabledPermissionsByIds.mockResolvedValue([
      { id: "permission-1", menuId: "menu-1", scopeEnabled: false },
    ]);

    await expect(
      service.createRoleInfo(
        dto([{ permissionId: "permission-1", dataScope: DataScope.ALL }]),
      ),
    ).rejects.toThrow("未启用数据范围");
  });

  it("keeps old clients compatible for scope-disabled permissions", async () => {
    roles.findEnabledPermissionsByIds.mockResolvedValue([
      { id: "permission-1", menuId: "menu-1", scopeEnabled: false },
    ]);

    await service.createRoleInfo(dto());

    expect(roles.syncRolePermissions).toHaveBeenCalledWith(
      "role-1",
      [{ permissionId: "permission-1", dataScope: null, departmentIds: [] }],
      tx,
    );
  });

  it("rejects scopes not selected by the same menu", async () => {
    await expect(
      service.createRoleInfo({
        ...dto(),
        menus: [
          {
            id: "menu-1",
            permissionIds: ["permission-1"],
            permissionScopes: [
              { permissionId: "permission-2", dataScope: DataScope.ALL },
            ],
          },
        ],
      }),
    ).rejects.toThrow("必须先勾选");
  });

  it("rejects a permission scope moved to another menu even when selected there", async () => {
    roles.findEnabledMenusByIds.mockResolvedValue([
      { id: "menu-1" },
      { id: "menu-2" },
    ]);

    await expect(
      service.createRoleInfo({
        ...dto(),
        menus: [
          { id: "menu-1", permissionIds: [] },
          {
            id: "menu-2",
            permissionIds: ["permission-1"],
            permissionScopes: [
              { permissionId: "permission-1", dataScope: DataScope.SELF },
            ],
          },
        ],
      }),
    ).rejects.toThrow("不属于菜单");
    expect(roles.create).not.toHaveBeenCalled();
  });

  it("rejects empty or disabled CUSTOM_DEFINE departments", async () => {
    await expect(
      service.createRoleInfo(
        dto([
          { permissionId: "permission-1", dataScope: DataScope.CUSTOM_DEFINE },
        ]),
      ),
    ).rejects.toThrow("至少选择一个部门");

    roles.findEnabledDepartmentsByIds.mockResolvedValue([{ id: "dept-1" }]);
    await expect(
      service.createRoleInfo(
        dto([
          {
            permissionId: "permission-1",
            dataScope: DataScope.CUSTOM_DEFINE,
            departmentIds: ["dept-1", "dept-disabled"],
          },
        ]),
      ),
    ).rejects.toThrow("不存在或已禁用");
  });

  it("rejects department residue for non-CUSTOM_DEFINE scopes", async () => {
    await expect(
      service.createRoleInfo(
        dto([
          {
            permissionId: "permission-1",
            dataScope: DataScope.ALL,
            departmentIds: ["dept-1"],
          },
        ]),
      ),
    ).rejects.toThrow("仅 CUSTOM_DEFINE");
  });

  it("invalidates assigned users after a committed scope update", async () => {
    roles.findByIdCode.mockResolvedValue({ id: "role-1", code: "sales" });
    roles.syncRoleMenus.mockResolvedValue(undefined);
    roles.syncRolePermissions.mockResolvedValue(undefined);

    await service.update({
      id: "role-1",
      ...dto([{ permissionId: "permission-1", dataScope: DataScope.SELF }]),
    });

    expect(cache.invalidateUsers).toHaveBeenCalledWith(["user-1"]);
  });

  it("does not invalidate users when the role transaction fails", async () => {
    roles.transaction.mockRejectedValueOnce(new Error("db failed"));

    await expect(
      service.update({
        id: "role-1",
        ...dto([{ permissionId: "permission-1", dataScope: DataScope.SELF }]),
      }),
    ).rejects.toThrow("db failed");
    expect(cache.invalidateUsers).not.toHaveBeenCalled();
  });

  it("echoes disabled historical CUSTOM_DEFINE departments", async () => {
    roles.findEnabledMenusWithPermissions.mockResolvedValue([
      {
        id: "menu-1",
        parentId: null,
        permissions: [
          {
            id: "permission-1",
            name: "读取客户",
            code: "customer:read",
            type: "BUTTON",
            resource: "customer",
            action: "read",
            scopeEnabled: true,
            enabled: true,
            sort: 1,
            menuId: "menu-1",
          },
        ],
      },
    ]);
    roles.findRoleMenuIds.mockResolvedValue([{ menuId: "menu-1" }]);
    roles.findRolePermissionScopes.mockResolvedValue([
      {
        permissionId: "permission-1",
        dataScope: DataScope.CUSTOM_DEFINE,
        customDepartments: [
          { department: { id: "dept-1", enabled: true } },
          { department: { id: "dept-disabled", enabled: false } },
        ],
      },
    ]);

    const result = await service.getRoleMenuAndPerList("role-1");
    const permission = result.list[0]?.permissions[0];

    expect(permission).toMatchObject({
      resource: "customer",
      action: "read",
      scopeEnabled: true,
      checked: true,
      dataScope: DataScope.CUSTOM_DEFINE,
      departmentIds: ["dept-1", "dept-disabled"],
      disabledDepartmentIds: ["dept-disabled"],
    });
  });

  it("returns explicit default scope fields for a new role", async () => {
    roles.findEnabledMenusWithPermissions.mockResolvedValue([
      {
        id: "menu-1",
        parentId: null,
        permissions: [
          {
            id: "permission-1",
            name: "读取客户",
            code: "customer:read",
            type: "BUTTON",
            resource: "customer",
            action: "read",
            scopeEnabled: true,
            enabled: true,
            sort: 1,
            menuId: "menu-1",
          },
        ],
      },
    ]);

    const result = await service.getRoleMenuAndPerList("__new__");

    expect(result.list[0]?.permissions[0]).toMatchObject({
      resource: "customer",
      action: "read",
      scopeEnabled: true,
      checked: false,
      dataScope: null,
      departmentIds: [],
      disabledDepartmentIds: [],
    });
  });

  it.each(["__new__", "role-1"])(
    "preserves existing menu and permission scalar fields for %s echo",
    async (roleId) => {
      roles.findEnabledMenusWithPermissions.mockResolvedValue([
        {
          id: "menu-1",
          parentId: null,
          name: "Customer",
          title: "客户管理",
          path: "/customer",
          component: "views/customer/index",
          sort: 1,
          enabled: true,
          permissions: [
            {
              id: "permission-1",
              name: "读取客户",
              code: "customer:read",
              type: "BUTTON",
              resource: "customer",
              action: "read",
              scopeEnabled: false,
              enabled: true,
              sort: 2,
              menuId: "menu-1",
            },
          ],
        },
      ]);
      roles.findRoleMenuIds.mockResolvedValue([{ menuId: "menu-1" }]);
      roles.findRolePermissionScopes.mockResolvedValue([
        {
          permissionId: "permission-1",
          dataScope: null,
          customDepartments: [],
        },
      ]);

      const result = await service.getRoleMenuAndPerList(roleId);

      expect(result.list[0]).toMatchObject({
        title: "客户管理",
        component: "views/customer/index",
      });
      expect(result.list[0]?.permissions[0]).toMatchObject({
        sort: 2,
        menuId: "menu-1",
        checked: roleId !== "__new__",
        dataScope: null,
        departmentIds: [],
        disabledDepartmentIds: [],
      });
    },
  );

  it("echoes an assigned scope-enabled permission with null scope as checked deny-all configuration", async () => {
    roles.findEnabledMenusWithPermissions.mockResolvedValue([
      {
        id: "menu-1",
        parentId: null,
        permissions: [
          {
            id: "permission-1",
            resource: "customer",
            action: "read",
            scopeEnabled: true,
            enabled: true,
          },
        ],
      },
    ]);
    roles.findRoleMenuIds.mockResolvedValue([{ menuId: "menu-1" }]);
    roles.findRolePermissionScopes.mockResolvedValue([
      { permissionId: "permission-1", dataScope: null, customDepartments: [] },
    ]);

    const result = await service.getRoleMenuAndPerList("role-1");

    expect(result.list[0]?.permissions[0]).toMatchObject({
      checked: true,
      scopeEnabled: true,
      dataScope: null,
      departmentIds: [],
      disabledDepartmentIds: [],
    });
  });
});
