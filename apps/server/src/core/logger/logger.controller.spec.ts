import { PERMISSION_KEY } from "#/processor/decorator/index.js";
import { LoggerController } from "./logger.controller.js";

vi.mock("./logger.service.js", () => ({
  LogService: class LogService {},
}));
vi.mock("./audit-log.service.js", () => ({
  AuditLogService: class AuditLogService {},
}));

describe("LoggerController permission boundary", () => {
  it.each([
    ["userLog:view", "getUserOperationLogList"],
    ["userLog:delete", "deleteUserOperationLog"],
    ["auditLog:view", "getAuditLogList"],
  ] as const)("requires %s on %s", (permission, methodName) => {
    expect(
      Reflect.getMetadata(PERMISSION_KEY, LoggerController.prototype[methodName]),
    ).toBe(permission);
  });
});
