import { PermissionType } from "#/prisma/generated/prisma/enums.js";
import type { RoleRepository } from "#/system/role/role.repository.js";
import type { RbacPermissionCacheService } from "#/processor/rbac/index.js";
import { UpdatePermissionDto } from "./dto/permission.dto.js";
import { PermissionRepository } from "./permission.repository.js";
import { PermissionService } from "./permission.service.js";

describe("PermissionService scope configuration", () => {
  const findUnique = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  const rolePermissionUpdateMany = vi.fn();
  const departmentsDeleteMany = vi.fn();
  const transaction = vi.fn((callback) =>
    callback({
      permission: { findUnique, update, delete: remove },
      rolePermission: { updateMany: rolePermissionUpdateMany },
      rolePermissionDepartment: { deleteMany: departmentsDeleteMany },
    }),
  );
  const roles = { findUserIdsByPermissionIds: vi.fn() };
  const cache = { invalidateUsers: vi.fn() };
  const service = new PermissionService(
    new PermissionRepository({ $transaction: transaction } as never),
    roles as unknown as RoleRepository,
    cache as unknown as RbacPermissionCacheService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({ id: "permission-1", scopeEnabled: true });
    update.mockResolvedValue({ id: "permission-1" });
    remove.mockResolvedValue({ id: "permission-1" });
    roles.findUserIdsByPermissionIds.mockResolvedValue([{ userId: "user-1" }]);
  });

  it("persists explicit resource action and scopeEnabled without splitting code", async () => {
    await service.update(
      UpdatePermissionDto.schema.parse({
        id: "permission-1",
        name: "读取客户",
        code: "crm:customer:read",
        resource: "customer",
        action: "read",
        scopeEnabled: true,
        type: PermissionType.BUTTON,
      }),
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "crm:customer:read",
          resource: "customer",
          action: "read",
          scopeEnabled: true,
        }),
      }),
    );
  });

  it("atomically clears scopes and custom departments when scopeEnabled becomes false", async () => {
    await service.update(
      UpdatePermissionDto.schema.parse({
        id: "permission-1",
        name: "读取客户",
        code: "crm:customer:read",
        scopeEnabled: false,
        type: PermissionType.BUTTON,
      }),
    );

    expect(departmentsDeleteMany).toHaveBeenCalledWith({
      where: { rolePermission: { permissionId: "permission-1" } },
    });
    expect(rolePermissionUpdateMany).toHaveBeenCalledWith({
      where: { permissionId: "permission-1" },
      data: { dataScope: null },
    });
    expect(cache.invalidateUsers).toHaveBeenCalledWith(["user-1"]);
  });

  it("keeps existing RolePermission dataScope null when enabling scope for fail-closed deny all", async () => {
    findUnique.mockResolvedValue({ id: "permission-1", scopeEnabled: false });

    await service.update(
      UpdatePermissionDto.schema.parse({
        id: "permission-1",
        name: "读取客户",
        code: "crm:customer:read",
        scopeEnabled: true,
        type: PermissionType.BUTTON,
      }),
    );

    expect(rolePermissionUpdateMany).not.toHaveBeenCalled();
    expect(departmentsDeleteMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scopeEnabled: true }),
      }),
    );
  });

  it("deletes from DB before invalidating affected users", async () => {
    const order: string[] = [];
    remove.mockImplementation(() => {
      order.push("delete");
      return Promise.resolve({ id: "permission-1" });
    });
    cache.invalidateUsers.mockImplementation(() => {
      order.push("invalidate");
      return Promise.resolve();
    });

    await service.remove("permission-1");

    expect(order).toEqual(["delete", "invalidate"]);
  });

  it("does not invalidate when permission deletion fails", async () => {
    remove.mockRejectedValueOnce(new Error("db failed"));

    await expect(service.remove("permission-1")).rejects.toThrow("db failed");
    expect(cache.invalidateUsers).not.toHaveBeenCalled();
  });
});
