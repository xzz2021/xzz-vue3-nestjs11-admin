import { PermissionType } from "#/generated/prisma/enums.js";
import { CreatePermissionDto } from "./permission.dto.js";

describe("Permission DTO scope metadata", () => {
  it("keeps legacy requests compatible", () => {
    expect(
      CreatePermissionDto.schema.parse({
        name: "读取客户",
        code: "crm:customer:read",
        type: PermissionType.BUTTON,
        menuId: "menu-1",
      }),
    ).toMatchObject({
      scopeEnabled: false,
    });
  });

  it("accepts explicit resource action and scopeEnabled", () => {
    expect(
      CreatePermissionDto.schema.parse({
        name: "读取客户",
        code: "opaque-code",
        resource: "customer",
        action: "read",
        scopeEnabled: true,
        type: PermissionType.BUTTON,
        menuId: "menu-1",
      }),
    ).toMatchObject({
      code: "opaque-code",
      resource: "customer",
      action: "read",
      scopeEnabled: true,
    });
  });
});
