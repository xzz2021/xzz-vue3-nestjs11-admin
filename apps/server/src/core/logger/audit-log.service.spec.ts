import { LOGIN_AUDIT_ACTION_PREFIX } from "./audit-action.js";
import { AuditLogService } from "./audit-log.service.js";
import { QueryAuditLogParams } from "./logger.dto.js";

describe("QueryAuditLogParams category", () => {
  it("accepts login and operation categories", () => {
    expect(
      QueryAuditLogParams.schema.parse({ category: "login" }),
    ).toMatchObject({ category: "login", pageIndex: 1, pageSize: 10 });
    expect(
      QueryAuditLogParams.schema.parse({ category: "operation" }),
    ).toMatchObject({ category: "operation" });
  });

  it("rejects unknown categories", () => {
    expect(() =>
      QueryAuditLogParams.schema.parse({ category: "other" }),
    ).toThrow();
  });
});

describe("AuditLogService.getAuditLogList", () => {
  const findMany = vi.fn();
  const count = vi.fn();
  const service = new AuditLogService(
    { error: vi.fn() } as never,
    {
      auditLog: { findMany, count },
    } as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it("filters login category by auth. action prefix", async () => {
    await service.getAuditLogList(
      QueryAuditLogParams.schema.parse({ category: "login" }),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: { startsWith: LOGIN_AUDIT_ACTION_PREFIX } },
      }),
    );
  });

  it("filters operation category by excluding auth. actions", async () => {
    await service.getAuditLogList(
      QueryAuditLogParams.schema.parse({ category: "operation" }),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: { not: { startsWith: LOGIN_AUDIT_ACTION_PREFIX } },
        },
      }),
    );
  });

  it("intersects an exact login action with the login category", async () => {
    await service.getAuditLogList(
      QueryAuditLogParams.schema.parse({
        category: "login",
        action: "auth.login_failed",
      }),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: {
            startsWith: LOGIN_AUDIT_ACTION_PREFIX,
            equals: "auth.login_failed",
          },
        },
      }),
    );
  });
});
