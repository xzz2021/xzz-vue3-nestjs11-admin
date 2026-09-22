import type { AuditLogService } from "#/core/logger/audit-log.service.js";
import { Prisma } from "#/generated/prisma/client.js";
import { OrganizationGenerationUnavailableException } from "#/processor/authorization/authorization.errors.js";
import type { OrganizationGenerationService } from "#/processor/authorization/organization-generation.service.js";
import type { DepartmentRepository } from "./department.repository.js";
import { DepartmentService } from "./department.service.js";

describe("DepartmentService organization generation", () => {
  const departments = {
    transaction: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
    findPathById: vi.fn(),
    findTreeLinks: vi.fn(),
    replaceDescendantPaths: vi.fn(),
    lockById: vi.fn(),
    findFirstChildId: vi.fn(),
    findDeleteReferences: vi.fn(),
    deleteById: vi.fn(),
  };
  const audit = { record: vi.fn() };
  const generation = { bump: vi.fn() };
  const service = new DepartmentService(
    departments as unknown as DepartmentRepository,
    audit as unknown as AuditLogService,
    generation as unknown as OrganizationGenerationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    departments.transaction.mockImplementation(
      (callback: (tx: object) => Promise<unknown>) => callback({}),
    );
    departments.create.mockResolvedValue({ id: "dept-1" });
    departments.updateById.mockResolvedValue({ id: "dept-1" });
    departments.findPathById.mockResolvedValue({ path: "/dept-1" });
    departments.lockById.mockResolvedValue({ id: "dept-1" });
    departments.findFirstChildId.mockResolvedValue(null);
    departments.findDeleteReferences.mockResolvedValue({
      customScope: false,
      customer: false,
    });
    departments.deleteById.mockResolvedValue({ id: "dept-1" });
    generation.bump.mockResolvedValue(undefined);
    audit.record.mockResolvedValue(undefined);
  });

  it("bumps after a department is added successfully", async () => {
    await service.add({ name: "研发", enabled: true });

    expect(generation.bump).toHaveBeenCalledTimes(1);
  });

  it("bumps after a department is moved or enabled state is updated", async () => {
    departments.findTreeLinks.mockResolvedValue([
      { id: "dept-1", parentId: null, path: "/dept-1" },
      { id: "dept-2", parentId: null, path: "/dept-2" },
    ]);

    await service.update({
      id: "dept-1",
      parentId: "dept-2",
      name: "研发",
      enabled: false,
    });

    expect(generation.bump).toHaveBeenCalledTimes(1);
  });

  it("bumps after a department is deleted successfully", async () => {
    await service.delete("dept-1");

    expect(generation.bump).toHaveBeenCalledTimes(1);
  });

  it("locks, checks references, and deletes inside one transaction", async () => {
    const tx = { marker: "delete-tx" };
    departments.transaction.mockImplementation(
      (callback: (client: object) => Promise<unknown>) => callback(tx),
    );

    await service.delete("dept-1");

    expect(departments.lockById).toHaveBeenCalledWith("dept-1", tx);
    expect(departments.findFirstChildId).toHaveBeenCalledWith("dept-1", tx);
    expect(departments.findDeleteReferences).toHaveBeenCalledWith("dept-1", tx);
    expect(departments.deleteById).toHaveBeenCalledWith("dept-1", tx);
  });

  it("does not bump when the database transaction fails", async () => {
    departments.transaction.mockRejectedValue(new Error("db failed"));

    await expect(service.add({ name: "研发", enabled: true })).rejects.toThrow(
      "db failed",
    );

    expect(generation.bump).not.toHaveBeenCalled();
  });

  it("does not bump when delete fails", async () => {
    departments.deleteById.mockRejectedValue(new Error("db failed"));

    await expect(service.delete("dept-1")).rejects.toThrow("db failed");

    expect(generation.bump).not.toHaveBeenCalled();
  });

  it("maps a concurrent foreign-key reference to BadRequest without audit or bump", async () => {
    departments.deleteById.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: "test",
        },
      ),
    );

    await expect(service.delete("dept-1")).rejects.toThrow(
      "部门仍被引用，无法删除",
    );

    expect(audit.record).not.toHaveBeenCalled();
    expect(generation.bump).not.toHaveBeenCalled();
  });

  it("records the audit before returning 503 when generation bump ultimately fails", async () => {
    generation.bump.mockRejectedValue(
      new OrganizationGenerationUnavailableException(),
    );

    await expect(
      service.add({ name: "研发", enabled: true }),
    ).rejects.toBeInstanceOf(OrganizationGenerationUnavailableException);

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(generation.bump).toHaveBeenCalledTimes(1);
    expect(audit.record.mock.invocationCallOrder[0]).toBeLessThan(
      generation.bump.mock.invocationCallOrder[0],
    );
  });
});
