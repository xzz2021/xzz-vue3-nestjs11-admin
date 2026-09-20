import { DataScope } from "#/prisma/generated/prisma/enums.js";
import type { PgService } from "#/prisma/pg.service.js";
import { RoleRepository } from "./role.repository.js";

describe("RoleRepository permission synchronization", () => {
  const findMany = vi.fn();
  const create = vi.fn();
  const createManyAndReturn = vi.fn();
  const update = vi.fn();
  const updateMany = vi.fn();
  const deleteMany = vi.fn();
  const departmentDeleteMany = vi.fn();
  const departmentCreateMany = vi.fn();
  const tx = {
    rolePermission: {
      findMany,
      create,
      createManyAndReturn,
      update,
      updateMany,
      deleteMany,
    },
    rolePermissionDepartment: {
      deleteMany: departmentDeleteMany,
      createMany: departmentCreateMany,
    },
  };
  const repository = new RoleRepository({} as PgService);

  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["legacy_rp_write"] } },
      data: { dataScope: DataScope.SELF },
    });
    expect(departmentDeleteMany).toHaveBeenCalledWith({
      where: { rolePermissionId: { in: ["legacy_rp_write"] } },
    });
    expect(updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining(["legacy_rp_read"]) } },
      }),
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

  it("batches permission creates, scope updates, and custom department writes", async () => {
    findMany.mockResolvedValue([
      {
        id: "existing-self",
        permissionId: "permission-self",
        dataScope: DataScope.ALL,
        customDepartments: [],
      },
      {
        id: "existing-custom",
        permissionId: "permission-custom",
        dataScope: DataScope.CUSTOM_DEFINE,
        customDepartments: [{ departmentId: "dept-old" }],
      },
    ]);
    createManyAndReturn.mockResolvedValue([
      { id: "created-1", permissionId: "permission-new" },
    ]);
    create.mockResolvedValue({ id: "created-1" });

    await repository.syncRolePermissions(
      "role-1",
      [
        {
          permissionId: "permission-self",
          dataScope: DataScope.SELF,
          departmentIds: [],
        },
        {
          permissionId: "permission-custom",
          dataScope: DataScope.CUSTOM_DEFINE,
          departmentIds: ["dept-new"],
        },
        {
          permissionId: "permission-new",
          dataScope: DataScope.CUSTOM_DEFINE,
          departmentIds: ["dept-a", "dept-b"],
        },
      ],
      tx,
    );

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          {
            roleId: "role-1",
            permissionId: "permission-new",
            dataScope: DataScope.CUSTOM_DEFINE,
          },
        ],
      }),
    );
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["existing-self"] } },
      data: { dataScope: DataScope.SELF },
    });
    expect(departmentDeleteMany).toHaveBeenCalledTimes(1);
    expect(departmentDeleteMany).toHaveBeenCalledWith({
      where: { rolePermissionId: { in: ["existing-self", "existing-custom"] } },
    });
    expect(departmentCreateMany).toHaveBeenCalledTimes(1);
    expect(departmentCreateMany).toHaveBeenCalledWith({
      data: [
        { rolePermissionId: "existing-custom", departmentId: "dept-new" },
        { rolePermissionId: "created-1", departmentId: "dept-a" },
        { rolePermissionId: "created-1", departmentId: "dept-b" },
      ],
    });
  });
});

describe("RoleRepository authorization tree ordering", () => {
  it("orders menus and permissions by sort then id for stable echo", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
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
