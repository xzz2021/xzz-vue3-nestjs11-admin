import { PERMISSION_KEY } from "#/processor/decorator/index.js";
import { OssController } from "./oss.controller.js";

jest.mock("./oss.service", () => ({
  OssService: class OssService {},
}));

describe("OssController permission boundary", () => {
  it.each([
    ["oss:view", "getConfig"],
    ["oss:view", "listObjects"],
    ["oss:view", "presignGet"],
    ["oss:add", "createFolder"],
    ["oss:add", "presignPut"],
    ["oss:add", "initiateMultipart"],
    ["oss:add", "listMultipartParts"],
    ["oss:add", "presignPart"],
    ["oss:add", "completeMultipart"],
    ["oss:add", "abortMultipart"],
    ["oss:add", "copyObjects"],
    ["oss:delete", "deleteObjects"],
    ["oss:view", "archiveFolder"],
  ] as const)("requires %s on %s", (permission, methodName) => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, OssController.prototype[methodName]),
    ).toBe(permission);
  });
});
