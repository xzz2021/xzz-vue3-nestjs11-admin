import { PERMISSION_KEY } from "@/processor/decorator/index.js";
import { MenuController } from "./menu.controller.js";

jest.mock("./menu.service", () => ({
  MenuService: class MenuService {},
}));

describe("MenuController permission boundary", () => {
  it.each([
    ["menu:add", "create"],
    ["menu:update", "update"],
    ["menu:view", "getMenuList"],
    ["menu:delete", "remove"],
    ["menu:update", "sort"],
  ] as const)("requires %s on %s", (permission, methodName) => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, MenuController.prototype[methodName]),
    ).toBe(permission);
  });
});
