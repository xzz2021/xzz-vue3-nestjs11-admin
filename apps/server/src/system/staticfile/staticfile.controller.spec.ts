import { PERMISSION_KEY } from "#/processor/decorator/index.js";
import { StaticfileController } from "./staticfile.controller.js";

vi.mock("./staticfile.service", () => ({
  StaticfileService: class StaticfileService {},
}));

vi.mock("./file-upload.service", () => ({
  FileUploadService: class FileUploadService {},
}));

vi.mock("./multer.config", () => ({
  generateMulterConfig: () => ({}),
  generateChunkMulterConfig: () => ({}),
}));

vi.mock("@nestjs/config", () => ({
  ConfigService: class ConfigService {
    get() {
      return "/static";
    }
  },
}));

describe("StaticfileController permission boundary", () => {
  it.each([
    ["fileList:view", "getFile2"],
    ["fileList:view", "getFile3"],
    ["fileList:view", "getFileList"],
    ["fileList:add", "uploadFile"],
    ["fileList:add", "initiateUpload"],
    ["fileList:add", "uploadChunk"],
    ["fileList:view", "getUploadSession"],
    ["fileList:add", "completeUpload"],
    ["fileList:add", "abortUpload"],
    ["fileList:delete", "deleteFile"],
  ] as const)("requires %s on %s", (permission, methodName) => {
    expect(
      Reflect.getMetadata(
        PERMISSION_KEY,
        StaticfileController.prototype[methodName],
      ),
    ).toBe(permission);
  });
});
