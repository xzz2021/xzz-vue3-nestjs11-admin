import {
  DataScope,
  MenuType,
  PermissionType,
} from "#/prisma/generated/prisma/enums.js";
import { RoleAuthorizationTreeRes } from "./role.dto.js";

describe("RoleAuthorizationTreeRes", () => {
  it("documents and validates recursive role authorization trees", () => {
    const permission = {
      id: "permission-1",
      name: "读取客户",
      code: "customer:read",
      type: PermissionType.BUTTON,
      resource: "customer",
      action: "read",
      scopeEnabled: true,
      enabled: true,
      sort: 2,
      menuId: "menu-root",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      checked: true,
      dataScope: DataScope.CUSTOM_DEFINE,
      departmentIds: ["dept-1"],
      disabledDepartmentIds: [],
    };
    const result = RoleAuthorizationTreeRes.schema.parse({
      list: [
        {
          id: "menu-root",
          name: "客户管理",
          title: "客户管理",
          path: "/customer",
          component: "views/customer/index",
          type: MenuType.MENU,
          sort: 1,
          enabled: true,
          parentId: null,
          checked: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          permissions: [permission],
          children: [
            {
              id: "menu-child",
              name: "客户列表",
              title: "客户列表",
              path: "list",
              type: MenuType.MENU,
              sort: 1,
              enabled: true,
              parentId: "menu-root",
              checked: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              permissions: [
                {
                  ...permission,
                  checked: false,
                  dataScope: null,
                  departmentIds: [],
                },
              ],
              children: [],
            },
          ],
        },
      ],
      message: "获取角色菜单及权限列表成功",
    });

    expect(result.list[0]?.children[0]?.permissions[0]).toMatchObject({
      resource: "customer",
      scopeEnabled: true,
      dataScope: null,
      departmentIds: [],
    });
    expect(result.list[0]).toMatchObject({
      title: "客户管理",
      component: "views/customer/index",
    });
    expect(result.list[0]?.permissions[0]).toMatchObject({
      sort: 2,
      menuId: "menu-root",
    });
  });
});
