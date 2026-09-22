import type { PgService } from "#/infrastructure/database/prisma/pg.service.js";
import { DepartmentRepository } from "./department.repository.js";

describe("DepartmentRepository", () => {
  it("loads an enabled subtree and excludes disabled departments", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValue([{ id: "root" }, { id: "child" }]);
    const repository = new DepartmentRepository({ $queryRaw: queryRaw } as any);

    await expect(repository.findSubtreeDepartmentIds("root")).resolves.toEqual([
      "root",
      "child",
    ]);

    const [strings, rootId] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(rootId).toBe("root");
    expect(strings.join("?")).toMatch(/enabled\s*=\s*true/gi);
  });

  it("locks the target row with FOR UPDATE on the transaction client", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: "dept-1" }]);
    const repository = new DepartmentRepository({} as PgService);
    const tx = { $queryRaw: queryRaw };

    await expect(repository.lockById("dept-1", tx as never)).resolves.toEqual({
      id: "dept-1",
    });

    const [strings, id] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(strings.join("?")).toMatch(
      /SELECT\s+"id"\s+FROM\s+"Department".*FOR\s+UPDATE/is,
    );
    expect(id).toBe("dept-1");
  });
});
