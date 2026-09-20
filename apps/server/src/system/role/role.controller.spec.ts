import { IS_AUTHENTICATED_KEY, PERMISSION_KEY } from "#/processor/decorator/index.js";
import { RoleController } from "./role.controller.js";

vi.mock("./role.service", () => ({
  RoleService: class RoleService {},
}));

describe("RoleController permission boundary", () => {
  it.each([
    ["role:view", "findAll"],
    ["role:add", "create"],
    ["role:update", "update"],
    ["role:view", "getRoleMenuAndPermission"],
    ["role:view", "getRoleDetail"],
    ["role:delete", "remove"],
    ["role:seed", "generateRoleSeed"],
  ] as const)("requires %s on %s", (permission, methodName) => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, RoleController.prototype[methodName]),
    ).toBe(permission);
  });

  it("requires login without a management permission for current user menu bootstrap", () => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, RoleController.prototype["getMenu"]),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        IS_AUTHENTICATED_KEY,
        RoleController.prototype["getMenu"],
      ),
    ).toBe(true);
  });
});
