import { AuditLogService } from "#/core/logger/audit-log.service.js";
import { CustomerStatus } from "#/prisma/generated/prisma/enums.js";
import { AuthorizationContext } from "#/processor/authorization/authorization-context.js";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { CustomerRepository } from "./customer.repository.js";
import { CustomerService } from "./customer.service.js";

const auth = (
  permissions: string[],
  code: string,
  grant: {
    all: boolean;
    scopes: Array<{ type: "SELF" } | { type: "DEPARTMENT"; ids: string[] }>;
  },
) =>
  new AuthorizationContext(
    "user-1",
    permissions,
    Object.fromEntries(
      [
        ...new Set([
          code,
          ...permissions.filter((permission) =>
            ["view", "detail", "add", "update", "delete", "export"].some(
              (action) => permission === `customer:${action}`,
            ),
          ),
        ]),
      ].map((permission) => [permission, { scoped: true as const, grant }]),
    ),
  );

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "A",
  phone: null,
  remark: null,
  status: CustomerStatus.LEAD,
  dealAmount: { toString: () => "10.00" },
  internalCost: { toString: () => "2.00" },
  confidential: false,
  ownerId: "user-1",
  departmentId: "dept-1",
  createdById: "user-1",
  version: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

describe("CustomerService", () => {
  const tx = {};
  const repository = {
    findPage: vi.fn(),
    findFirst: vi.fn(),
    transaction: vi.fn((callback) => callback(tx)),
    create: vi.fn(),
    lockCustomerForUpdate: vi.fn(),
    lockUsersForShare: vi.fn(),
    lockDepartmentsForShare: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    findExportBatch: vi.fn(),
  };
  const audit = { record: vi.fn() };
  const service = new CustomerService(
    repository as unknown as CustomerRepository,
    audit as unknown as AuditLogService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    audit.record.mockReset();
    audit.record.mockResolvedValue(undefined);
    repository.findFirst.mockReset();
    repository.findExportBatch.mockReset();
    repository.transaction.mockImplementation((callback) => callback(tx));
    repository.lockCustomerForUpdate.mockResolvedValue(true);
    repository.lockDepartmentsForShare.mockImplementation((ids: string[]) =>
      Promise.resolve(ids.map((id) => ({ id, enabled: true }))),
    );
    repository.lockUsersForShare.mockImplementation((ids: string[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          enabled: true,
          departmentId: id === "user-2" ? "dept-2" : "dept-1",
        })),
      ),
    );
    repository.create.mockResolvedValue(row());
    repository.updateMany.mockResolvedValue({ count: 1 });
    repository.deleteMany.mockResolvedValue({ count: 1 });
  });

  it.each([
    ["list", () => service.list({}, undefined)],
    ["detail", () => service.detail("c1", undefined)],
    ["create", () => service.create({ name: "A" }, undefined)],
    [
      "update",
      () => service.update({ id: "c1", version: 0, name: "B" }, undefined),
    ],
    ["delete", () => service.delete(["c1"], undefined)],
    ["export", () => service.export({}, undefined)],
  ])(
    "fails closed when authorization context is missing for %s",
    async (_name, call) => {
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.findFirst).not.toHaveBeenCalled();
    },
  );

  it("uses one policy instance for an entire list and does no per-row I/O", async () => {
    repository.findPage.mockResolvedValue([[row(), row({ id: "c2" })], 2]);
    const context = auth(
      [
        "customer:view",
        "customer:update",
        "customer:delete",
        "customer:assign",
      ],
      "customer:view",
      {
        all: true,
        scopes: [],
      },
    );

    const result = await service.list({}, context);

    expect(result.list).toHaveLength(2);
    expect(result.list[0]?.capabilities).toEqual(["update", "delete"]);
    expect(repository.findPage).toHaveBeenCalledTimes(1);
    expect(repository.findFirst).not.toHaveBeenCalled();
  });

  it("creates SELF records with forced actor/department and rejects forged targets", async () => {
    const context = auth(["customer:add"], "customer:add", {
      all: false,
      scopes: [{ type: "SELF" }],
    });

    await service.create({ name: "A" }, context);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "user-1",
        departmentId: "dept-1",
        createdById: "user-1",
      }),
      tx,
    );
    expect(repository.lockUsersForShare).toHaveBeenCalledWith(["user-1"], tx);
    expect(repository.lockDepartmentsForShare).toHaveBeenCalledWith(
      ["dept-1"],
      tx,
    );
    await expect(
      service.create({ name: "A", ownerId: "user-2" }, context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create({ name: "A", departmentId: "dept-2" }, context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows a target matching any create scope branch and requires assign for explicit reassignment", async () => {
    const grant = {
      all: false,
      scopes: [
        { type: "SELF" as const },
        { type: "DEPARTMENT" as const, ids: ["dept-2"] },
      ],
    };
    const denied = auth(["customer:add"], "customer:add", grant);
    const allowed = auth(
      ["customer:add", "customer:assign"],
      "customer:add",
      grant,
    );
    repository.lockDepartmentsForShare.mockResolvedValueOnce([
      { id: "dept-2", enabled: true },
    ]);

    await expect(
      service.create(
        { name: "A", ownerId: "user-2", departmentId: "dept-2" },
        denied,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    repository.lockDepartmentsForShare.mockResolvedValueOnce([
      { id: "dept-2", enabled: true },
    ]);
    await expect(
      service.create(
        { name: "A", ownerId: "user-2", departmentId: "dept-2" },
        allowed,
      ),
    ).resolves.toBeDefined();
  });

  it("locks actor, final owner, then department in a stable create order", async () => {
    const context = auth(["customer:add", "customer:assign"], "customer:add", {
      all: true,
      scopes: [],
    });
    repository.lockDepartmentsForShare.mockResolvedValue([
      { id: "dept-2", enabled: true },
    ]);

    await service.create(
      { name: "A", ownerId: "user-2", departmentId: "dept-2" },
      context,
    );

    expect(repository.lockUsersForShare).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      tx,
    );
    const usersLockOrder =
      repository.lockUsersForShare.mock.invocationCallOrder[0];
    const departmentLockOrder =
      repository.lockDepartmentsForShare.mock.invocationCallOrder[0];
    expect(usersLockOrder).toBeLessThan(departmentLockOrder);
  });

  it("validates enabled owner and department membership and missing actor department", async () => {
    const context = auth(["customer:add", "customer:assign"], "customer:add", {
      all: true,
      scopes: [],
    });
    repository.lockUsersForShare.mockResolvedValueOnce([
      { id: "user-1", enabled: true, departmentId: "dept-1" },
      { id: "user-2", enabled: true, departmentId: "dept-1" },
    ]);

    await expect(
      service.create(
        { name: "A", ownerId: "user-2", departmentId: "dept-2" },
        context,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    repository.lockUsersForShare.mockResolvedValueOnce([
      { id: "user-1", enabled: true, departmentId: null },
    ]);
    await expect(service.create({ name: "A" }, context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("checks the patched next object to block low-to-high updates and scope moves", async () => {
    repository.findFirst.mockResolvedValue(row());
    const context = auth(
      ["customer:update", "customer:assign"],
      "customer:update",
      {
        all: false,
        scopes: [{ type: "SELF" }],
      },
    );

    await expect(
      service.update(
        { id: "c1", version: 0, dealAmount: "100000.00" },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.update(
        { id: "c1", version: 0, ownerId: "user-2", departmentId: "dept-2" },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("distinguishes invisible records from stale versions without leaking scope", async () => {
    const context = auth(["customer:update"], "customer:update", {
      all: true,
      scopes: [],
    });
    repository.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.update({ id: "missing", version: 0, name: "B" }, context),
    ).rejects.toBeInstanceOf(ForbiddenException);

    repository.findFirst
      .mockResolvedValueOnce(row({ version: 2 }))
      .mockResolvedValueOnce(row({ version: 2 }));
    await expect(
      service.update({ id: "c1", version: 0, name: "B" }, context),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.updateMany).not.toHaveBeenCalled();
  });

  it("locks and performs the complete update decision inside one transaction", async () => {
    const context = auth(
      ["customer:update", "customer:assign"],
      "customer:update",
      { all: true, scopes: [] },
    );
    repository.findFirst.mockResolvedValue(row());

    await service.update(
      { id: "c1", version: 0, ownerId: "user-2", departmentId: "dept-2" },
      context,
    );

    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.findFirst).toHaveBeenCalledTimes(2);
    expect(repository.lockUsersForShare).toHaveBeenCalledWith(
      ["user-1", "user-2"],
      tx,
    );
    expect(repository.lockDepartmentsForShare).toHaveBeenCalledWith(
      ["dept-1", "dept-2"],
      tx,
    );
    expect(repository.lockCustomerForUpdate).toHaveBeenCalledWith("c1", tx);
    expect(repository.findFirst).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(repository.updateMany).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      tx,
    );
    const userOrder = repository.lockUsersForShare.mock.invocationCallOrder[0];
    const departmentOrder =
      repository.lockDepartmentsForShare.mock.invocationCallOrder[0];
    const customerOrder =
      repository.lockCustomerForUpdate.mock.invocationCallOrder[0];
    expect(userOrder).toBeLessThan(departmentOrder);
    expect(departmentOrder).toBeLessThan(customerOrder);
  });

  it("locks only Customer when ownership fields cannot change", async () => {
    const context = auth(["customer:update"], "customer:update", {
      all: true,
      scopes: [],
    });
    repository.findFirst.mockResolvedValue(row());

    await service.update({ id: "c1", version: 0, name: "B" }, context);

    expect(repository.lockUsersForShare).not.toHaveBeenCalled();
    expect(repository.lockDepartmentsForShare).not.toHaveBeenCalled();
    expect(repository.lockCustomerForUpdate).toHaveBeenCalledWith("c1", tx);
  });

  it("uses only the post-lock row for version and policy decisions", async () => {
    const context = auth(
      ["customer:update", "customer:assign"],
      "customer:update",
      { all: true, scopes: [] },
    );
    repository.findFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ version: 1 }));

    await expect(
      service.update(
        { id: "c1", version: 0, ownerId: "user-2", departmentId: "dept-2" },
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.updateMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the post-lock row has become attribute-denied", async () => {
    const context = auth(["customer:update"], "customer:update", {
      all: true,
      scopes: [],
    });
    repository.findFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: CustomerStatus.FROZEN }));

    await expect(
      service.update({ id: "c1", version: 0, name: "B" }, context),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateMany).not.toHaveBeenCalled();
  });

  it("rechecks policy after an unexpected zero-row update and returns 409 only while still operable", async () => {
    const context = auth(["customer:update"], "customer:update", {
      all: true,
      scopes: [],
    });
    repository.findFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row());
    repository.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.update({ id: "c1", version: 0, name: "B" }, context),
    ).rejects.toBeInstanceOf(ConflictException);

    repository.findFirst.mockReset();
    repository.findFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(null);
    repository.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.update({ id: "c1", version: 0, name: "B" }, context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("requires sensitive-update only when sensitive values change", async () => {
    repository.findFirst.mockResolvedValue(row());
    const context = auth(["customer:update"], "customer:update", {
      all: true,
      scopes: [],
    });

    await expect(
      service.update({ id: "c1", version: 0, internalCost: "9.00" }, context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("treats equivalent decimal representations as an unchanged sensitive value", async () => {
    repository.findFirst.mockResolvedValue(
      row({ internalCost: { toString: () => "2" } }),
    );
    const context = auth(["customer:update"], "customer:update", {
      all: true,
      scopes: [],
    });

    await expect(
      service.update({ id: "c1", version: 0, internalCost: "2.00" }, context),
    ).resolves.toEqual({
      id: "c1",
      message: "更新客户成功",
    });
  });

  it("deletes all-or-nothing in one transaction and rolls back on concurrent count mismatch", async () => {
    const context = auth(["customer:delete"], "customer:delete", {
      all: true,
      scopes: [],
    });
    repository.findMany.mockResolvedValueOnce([row()]);
    await expect(service.delete(["c1", "c2"], context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.deleteMany).not.toHaveBeenCalled();

    repository.findMany.mockResolvedValueOnce([row()]);
    repository.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.delete(["c1"], context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.transaction).toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("uses the independent export decision, batches at 500 and caps at 10000", async () => {
    const context = new AuthorizationContext(
      "user-1",
      ["customer:view", "customer:export"],
      {
        "customer:view": { scoped: true, grant: { all: true, scopes: [] } },
        "customer:export": {
          scoped: true,
          grant: { all: false, scopes: [{ type: "SELF" }] },
        },
      },
    );
    repository.findExportBatch
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, index) => row({ id: `c${index}` })),
      )
      .mockResolvedValueOnce([]);

    const stream = await service.export({}, context);
    for await (const _chunk of stream) {
      // consume the stream so the success audit runs
    }

    expect(repository.findExportBatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        AND: expect.arrayContaining([{ OR: [{ ownerId: "user-1" }] }]),
      }),
      undefined,
      500,
    );
    expect(repository.findExportBatch).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        metadata: { outcome: "success", count: 500 },
      }),
    );
  });

  it("does not export internalCost without sensitive-view", async () => {
    const context = auth(["customer:export"], "customer:export", {
      all: true,
      scopes: [],
    });
    repository.findExportBatch
      .mockResolvedValueOnce([row()])
      .mockResolvedValueOnce([]);

    const stream = await service.export({}, context);
    let csv = "";
    for await (const chunk of stream) csv += chunk.toString();

    expect(csv).toContain("dealAmount,internalCost");
    expect(csv).not.toContain("10.00,2.00");
    expect(csv).toContain("10.00,,");
  });

  it("stops export at 10000 rows without loading the full result set", async () => {
    const context = auth(["customer:export"], "customer:export", {
      all: true,
      scopes: [],
    });
    repository.findExportBatch.mockImplementation(
      (_where, _cursor, take: number) =>
        Promise.resolve(
          Array.from({ length: take }, (_, index) =>
            row({ id: `batch-${index}` }),
          ),
        ),
    );

    const stream = await service.export({}, context);
    for await (const _chunk of stream) {
      // consume
    }

    expect(repository.findExportBatch).toHaveBeenCalledTimes(20);
    expect(
      repository.findExportBatch.mock.calls.every((call) => call[2] === 500),
    ).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        metadata: { outcome: "success", count: 10000 },
      }),
    );
  });

  it("audits a stable failed outcome when a later export batch throws", async () => {
    const context = auth(["customer:export"], "customer:export", {
      all: true,
      scopes: [],
    });
    repository.findExportBatch
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, index) => row({ id: `c${index}` })),
      )
      .mockRejectedValueOnce(new Error("sensitive db details"));

    const stream = await service.export({}, context);
    await expect(async () => {
      for await (const _chunk of stream) {
        // consume
      }
    }).rejects.toThrow("sensitive db details");

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        metadata: {
          outcome: "failed",
          count: 500,
          errorCode: "CUSTOMER_EXPORT_READ_FAILED",
        },
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      "sensitive db details",
    );
  });

  it("audits aborted streams and absorbs audit failures without unhandled rejection", async () => {
    const context = auth(["customer:export"], "customer:export", {
      all: true,
      scopes: [],
    });
    repository.findExportBatch.mockResolvedValue(
      Array.from({ length: 500 }, (_, index) => row({ id: `c${index}` })),
    );
    audit.record.mockImplementationOnce(() => {
      throw new Error("audit unavailable");
    });

    const stream = await service.export({}, context);
    stream.resume();
    stream.destroy();
    await new Promise<void>((resolve) => stream.once("close", () => resolve()));
    await new Promise((resolve) => setImmediate(resolve));

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        metadata: expect.objectContaining({ outcome: "aborted" }),
      }),
    );
  });

  it("never writes sensitive values to audit metadata", async () => {
    const context = auth(
      ["customer:add", "customer:sensitive-update"],
      "customer:add",
      { all: true, scopes: [] },
    );

    await service.create(
      { name: "A", phone: "123", internalCost: "9.00", confidential: true },
      context,
    );

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          phone: expect.anything(),
          internalCost: expect.anything(),
        }),
      }),
    );
  });
});
