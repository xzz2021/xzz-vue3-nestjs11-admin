import { DataScope } from "@/prisma/generated/prisma/enums.js";
import type { PgService } from "@/prisma/pg.service.js";
import { RoleRepository } from "./role.repository.js";

describe("RoleRepository permission synchronization", () => {
  const findMany = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const deleteMany = jest.fn();
  const departmentDeleteMany = jest.fn();
  const departmentCreateMany = jest.fn();
  const tx = {
    rolePermission: { findMany, create, update, deleteMany },
    rolePermissionDepartment: {
      deleteMany: departmentDeleteMany,
      createMany: departmentCreateMany,
    },
  };
  const repository = new RoleRepository({} as PgService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserves unchanged legacy RolePermission ids and updates only changed scopes", async () => {
    findMany.mockResolvedValue([
      {
        id: "legacy_rp_read",
        permissionId: "permission-read",
        dataScope: DataScope.CUSTOM_DEFINE,
        customDepartments: [{ departmentId: "dept-1" }],
      },
      {
        id: "legacy_rp_write",
        permissionId: "permission-write",
        dataScope: DataScope.ALL,
        customDepartments: [],
      },
    ]);

    await repository.syncRolePermissions(
      "role-1",
      [
        {
          permissionId: "permission-read",
          dataScope: DataScope.CUSTOM_DEFINE,
          departmentIds: ["dept-1"],
        },
        {
          permissionId: "permission-write",
          dataScope: DataScope.SELF,
          departmentIds: [],
        },
      ],
      tx,
    );

    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "legacy_rp_write" },
      data: { dataScope: DataScope.SELF },
    });
    expect(departmentDeleteMany).toHaveBeenCalledWith({
      where: { rolePermissionId: "legacy_rp_write" },
    });
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "legacy_rp_read" } }),
    );
  });

  it("deletes removed permissions so custom departments cascade and re-add starts fresh", async () => {
    findMany.mockResolvedValue([
      {
        id: "legacy_rp_removed",
        permissionId: "permission-removed",
        dataScope: DataScope.CUSTOM_DEFINE,
        customDepartments: [{ departmentId: "dept-1" }],
      },
    ]);

    await repository.syncRolePermissions("role-1", [], tx);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["legacy_rp_removed"] } },
    });
    expect(departmentDeleteMany).not.toHaveBeenCalled();
  });
});

describe("RoleRepository authorization tree ordering", () => {
  it("orders menus and permissions by sort then id for stable echo", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new RoleRepository({ menu: { findMany } });

    await repository.findEnabledMenusWithPermissions();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sort: "asc" }, { id: "asc" }],
        include: {
          permissions: {
            orderBy: [{ sort: "asc" }, { id: "asc" }],
          },
        },
      }),
    );
  });
});
