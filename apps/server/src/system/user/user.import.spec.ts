import { Readable } from "node:stream";
import type { RbacPermissionCacheService } from "#/processor/rbac/index.js";
import type { SessionRevocationService } from "#/system/auth/session-revocation.service.js";
import type { FileCleanupService } from "#/system/file-cleanup/file-cleanup.service.js";
import { UserService } from "./user.service.js";
import { USER_IMPORT_MAX_ROWS, userImportTemplateCsv } from "./user.csv.js";
import type { UserRepository } from "./user.repository.js";

vi.mock("#/processor/utils/index.js", () => ({
  formatDateToYMDHMS: vi.fn(),
  hashPayPassword: vi.fn(() => Promise.resolve("hashed")),
  verifyPayPassword: vi.fn(() => Promise.resolve(true)),
}));

describe("UserService CSV import / export", () => {
  const findByPhone = vi.fn();
  const findIdByEmail = vi.fn();
  const findEnabledDepartment = vi.fn();
  const findEnabledRolesByCodes = vi.fn();
  const createWithRelations = vi.fn();
  const findExportBatch = vi.fn();
  const findSubtreeDepartmentIds = vi.fn();
  const auditRecord = vi.fn();

  const createService = () =>
    new UserService(
      {
        findByPhone,
        findIdByEmail,
        findEnabledDepartment,
        findEnabledRolesByCodes,
        createWithRelations,
        findExportBatch,
        findSubtreeDepartmentIds,
      } as unknown as UserRepository,
      { invalidateUsers: vi.fn() } as unknown as RbacPermissionCacheService,
      { revokeAll: vi.fn() } as unknown as SessionRevocationService,
      { get: () => "api/public" } as unknown as import("@nestjs/config").ConfigService,
      { enqueue: vi.fn() } as unknown as FileCleanupService,
      { record: auditRecord } as unknown as import("#/core/logger/audit-log.service.js").AuditLogService,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    findByPhone.mockResolvedValue(null);
    findIdByEmail.mockResolvedValue(null);
    findEnabledDepartment.mockResolvedValue({ id: "dept-1", enabled: true });
    findEnabledRolesByCodes.mockResolvedValue([{ id: "role-1", code: "admin" }]);
    createWithRelations.mockResolvedValue({ id: "user-new" });
    findExportBatch.mockResolvedValue([]);
  });

  it("imports a valid row and records a summary audit", async () => {
    const csv = `${userImportTemplateCsv()}zhangsan,13800138000,ChangeMe_Now!,小张,zhang@example.com,dept-1,admin,true\r\n`;
    const result = await createService().importUsers(Buffer.from(csv), "op-1", "127.0.0.1");

    expect(result).toMatchObject({ success: 1, failed: 0, errors: [] });
    expect(createWithRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "zhangsan",
        phone: "13800138000",
        departmentId: "dept-1",
        roleIds: ["role-1"],
        email: "zhang@example.com",
      }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.import",
        metadata: expect.objectContaining({ success: 1, failed: 0 }),
      }),
    );
  });

  it("keeps going when a row phone already exists", async () => {
    findByPhone.mockResolvedValueOnce({ id: "exists" });
    const csv = `${userImportTemplateCsv()}zhangsan,13800138000,ChangeMe_Now!,,,dept-1,,\r\n`;
    const result = await createService().importUsers(Buffer.from(csv), "op-1");

    expect(result.success).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]?.row).toBe(2);
    expect(result.errors[0]?.message).toMatch(/手机号/);
    expect(createWithRelations).not.toHaveBeenCalled();
  });

  it("rejects files over the import row limit", async () => {
    const rows = Array.from(
      { length: USER_IMPORT_MAX_ROWS + 1 },
      (_, i) => `user${i},1380013${String(8000 + i).slice(-4)},ChangeMe_Now!,,,dept-1,,`,
    );
    const csv = `${userImportTemplateCsv()}${rows.join("\r\n")}\r\n`;
    await expect(createService().importUsers(Buffer.from(csv), "op-1")).rejects.toThrow(
      /最多/,
    );
  });

  it("streams export rows without passwords and records audit", async () => {
    findExportBatch
      .mockResolvedValueOnce([
        {
          id: "u1",
          username: "zhangsan",
          phone: "13800138000",
          nickname: null,
          email: null,
          departmentId: "dept-1",
          enabled: true,
          createdAt: new Date("2026-01-02T03:04:05.000Z"),
          roles: [{ role: { code: "admin" } }],
        },
      ])
      .mockResolvedValueOnce([]);

    const stream = await createService().exportUsers({}, "op-1", "127.0.0.1");
    const text = await readStream(stream);

    expect(text).toContain("username,phone");
    expect(text).toContain("zhangsan,13800138000");
    expect(text.toLowerCase()).not.toContain("password");
    await vi.waitFor(() =>
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.export",
          metadata: expect.objectContaining({ outcome: "success", count: 1 }),
        }),
      ),
    );
  });
});

async function readStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
