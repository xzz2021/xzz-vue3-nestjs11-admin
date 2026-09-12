import { IS_PUBLIC_KEY, PERMISSION_KEY } from "@/processor/decorator/index.js";
import { DictionaryController } from "./dictionary.controller.js";

jest.mock("./dictionary.service", () => ({
  DictionaryService: class DictionaryService {},
}));

describe("DictionaryController permission boundary", () => {
  it("no longer exposes the dictionary list publicly", () => {
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        DictionaryController.prototype["findAll"],
      ),
    ).toBeUndefined();
  });

  it.each([
    ["dictionary:view", "findAll"],
    ["dictionary:update", "upsertDictionary"],
    ["dictionary:delete", "delete"],
    ["dictionary:update", "createEntry"],
    ["dictionary:delete", "deleteEntry"],
    ["dictionary:seed", "generateDictionarySeed"],
  ] as const)("requires %s on %s", (permission, methodName) => {
    expect(
      Reflect.getMetadata(
        PERMISSION_KEY,
        DictionaryController.prototype[methodName],
      ),
    ).toBe(permission);
  });
});
