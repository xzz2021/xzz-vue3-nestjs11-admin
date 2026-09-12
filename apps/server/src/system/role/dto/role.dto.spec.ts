import { DataScope } from "#/prisma/generated/prisma/enums.js";
import { CreateRoleDto } from "./role.dto.js";

describe("CreateRoleDto permission scopes", () => {
  const base = {
    name: "销售",
    code: "sales",
    enabled: true,
  };

  it("deduplicates permission and custom department ids", () => {
    const parsed = CreateRoleDto.schema.parse({
      ...base,
      menus: [
        {
          id: "menu-1",
          permissionIds: ["permission-1", "permission-1"],
          permissionScopes: [
            {
              permissionId: "permission-1",
              dataScope: DataScope.CUSTOM_DEFINE,
              departmentIds: ["dept-1", "dept-1"],
            },
          ],
        },
      ],
    });

    expect(parsed.menus[0]?.permissionIds).toEqual(["permission-1"]);
    expect(parsed.menus[0]?.permissionScopes?.[0]?.departmentIds).toEqual([
      "dept-1",
    ]);
  });

  it("rejects duplicate scope entries for one permission", () => {
    expect(() =>
      CreateRoleDto.schema.parse({
        ...base,
        menus: [
          {
            id: "menu-1",
            permissionIds: ["permission-1"],
            permissionScopes: [
              { permissionId: "permission-1", dataScope: DataScope.ALL },
              { permissionId: "permission-1", dataScope: DataScope.SELF },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects empty identifiers in scope entries", () => {
    expect(() =>
      CreateRoleDto.schema.parse({
        ...base,
        menus: [
          {
            id: "menu-1",
            permissionIds: ["permission-1"],
            permissionScopes: [{ permissionId: "", dataScope: DataScope.ALL }],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate menu ids globally", () => {
    expect(() =>
      CreateRoleDto.schema.parse({
        ...base,
        menus: [
          { id: "menu-1", permissionIds: ["permission-1"] },
          { id: "menu-1", permissionIds: ["permission-2"] },
        ],
      }),
    ).toThrow("菜单 menu-1 重复");
  });
});
