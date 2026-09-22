import { IS_AUTHENTICATED_KEY, PERMISSION_KEY } from "#/processor/decorator/index.js";
import { UserController } from "./user.controller.js";

vi.mock("./user.service", () => ({
  UserService: class UserService {},
}));

describe("UserController permission boundary", () => {
  it.each([
    ["user:view", "findBy"],
    ["user:update", "resetPassword"],
    ["user:add", "addUser"],
    ["user:update", "update"],
    ["user:delete", "delete"],
    ["user:view", "allList"],
    ["user:export", "exportUsers"],
    ["user:import", "importUsers"],
    ["user:import", "importTemplate"],
  ] as const)("requires %s on %s", (permission, methodName) => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, UserController.prototype[methodName]),
    ).toBe(permission);
  });

  it.each([
    "detailInfo",
    "updatePersonalInfo",
    "updatePassword",
    "uploadAvatar",
    "lookup",
  ] as const)("requires login without a management permission for %s", (methodName) => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, UserController.prototype[methodName]),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        IS_AUTHENTICATED_KEY,
        UserController.prototype[methodName],
      ),
    ).toBe(true);
  });
});
