import type { Prisma } from "#/generated/prisma/client.js";
import type { PgService } from "#/infrastructure/database/prisma/pg.service.js";
import { CustomerRepository } from "./customer.repository.js";

interface SqlQuery {
  strings: string[];
  values: unknown[];
}

describe("CustomerRepository row locks", () => {
  const queryRaw = vi.fn();
  const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;
  const repository = new CustomerRepository({} as PgService);

  beforeEach(() => vi.clearAllMocks());

  it("locks a customer with parameterized FOR UPDATE", async () => {
    queryRaw.mockResolvedValue([{ id: "customer-1" }]);

    await expect(
      repository.lockCustomerForUpdate("customer-1", tx),
    ).resolves.toBe(true);

    const query = queryRaw.mock.calls[0]?.[0] as SqlQuery;
    expect(query.strings.join("")).toContain("FOR UPDATE");
    expect(query.strings.join("")).not.toContain("customer-1");
    expect(query.values).toContain("customer-1");
  });

  it("deduplicates and sorts users in one parameterized FOR SHARE query", async () => {
    queryRaw.mockResolvedValueOnce([
      { id: "user-a", enabled: true, departmentId: "dept-1" },
      { id: "user-b", enabled: true, departmentId: "dept-1" },
    ]);

    await expect(
      repository.lockUsersForShare(["user-b", "user-a", "user-b"], tx),
    ).resolves.toHaveLength(2);

    const query = queryRaw.mock.calls[0]?.[0] as SqlQuery;
    expect(query.strings.join("")).toContain('ORDER BY "id"');
    expect(query.strings.join("")).toContain("FOR SHARE");
    expect(query.strings.join("")).not.toContain("user-a");
    expect(query.values).toEqual(["user-a", "user-b"]);
  });

  it("deduplicates and sorts departments in one parameterized FOR SHARE query", async () => {
    queryRaw.mockResolvedValue([
      { id: "dept-a", enabled: true },
      { id: "dept-b", enabled: true },
    ]);

    await repository.lockDepartmentsForShare(
      ["dept-b", "dept-a", "dept-b"],
      tx,
    );

    const query = queryRaw.mock.calls[0]?.[0] as SqlQuery;
    expect(query.strings.join("")).toContain('ORDER BY "id"');
    expect(query.strings.join("")).toContain("FOR SHARE");
    expect(query.values).toEqual(["dept-a", "dept-b"]);
  });
});
