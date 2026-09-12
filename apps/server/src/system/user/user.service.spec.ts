import type { RbacPermissionCacheService } from "@/processor/rbac/index.js";
import type { SessionRevocationService } from "@/system/auth/session-revocation.service.js";
import type { FileCleanupService } from "@/system/file-cleanup/file-cleanup.service.js";
import type { PgService } from "@/prisma/pg.service.js";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

jest.mock("@/processor/utils", () => ({
  formatDateToYMDHMS: jest.fn(),
  hashPayPassword: jest.fn(() => Promise.resolve("hashed")),
  verifyPayPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("@/system/staticfile/multer.config", () => ({
  sanitizePathSegment: (segment: string) =>
    segment.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "unknown",
  getStaticFileRoot: () => "/static-root",
  tryResolvePathInsideRoot: (root: string, target: string) =>
    target.startsWith(`${root}/`) || target === root
      ? target
      : target.startsWith("/")
        ? null
        : `${root}/${target}`,
}));

describe("UserService session revocation", () => {
  const userUpdate = jest.fn();
  const userFindUnique = jest.fn();
  const invalidateUsers = jest.fn();
  const revokeAll = jest.fn();

  const createService = () =>
    new UserService(
      new UserRepository({
        user: { update: userUpdate, findUnique: userFindUnique },
        $transaction: jest.fn(),
      }),
      { invalidateUsers } as unknown as RbacPermissionCacheService,
      { revokeAll } as unknown as SessionRevocationService,
      {
        get: () => "api/public",
      } as unknown as import("@nestjs/config").ConfigService,
      { enqueue: jest.fn() } as unknown as FileCleanupService,
      {
        record: jest.fn(),
      } as unknown as import("@/core/logger/audit-log.service.js").AuditLogService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    userUpdate.mockResolvedValue({ id: "user-1" });
    invalidateUsers.mockResolvedValue(undefined);
    revokeAll.mockResolvedValue(undefined);
  });

  it("revokes all sessions after password change", async () => {
    userFindUnique.mockResolvedValue({ id: "user-1", password: "old-hash" });
    const service = createService();

    await service.updatePassword({
      id: "user-1",
      password: "old-pass",
      newPassword: "new-pass-1",
    });

    expect(revokeAll).toHaveBeenCalledWith("user-1");
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordChangedAt: expect.any(Date) }),
      }),
    );
  });

  it("revokes all sessions after admin password reset", async () => {
    const service = createService();

    await service.resetPassword({
      id: "user-1",
      password: "NewPass_123!",
      operateId: "admin-1",
    });

    expect(revokeAll).toHaveBeenCalledWith("user-1");
  });

  it("revokes all sessions when user is disabled", async () => {
    const service = createService();

    await service.update({
      id: "user-1",
      username: "alice",
      phone: "13800138000",
      department: "dept-1",
      roles: [],
      enabled: false,
    });

    expect(invalidateUsers).toHaveBeenCalledWith(["user-1"]);
    expect(revokeAll).toHaveBeenCalledWith("user-1");
  });

  it("does not revoke sessions when user remains enabled", async () => {
    const service = createService();

    await service.update({
      id: "user-1",
      username: "alice",
      phone: "13800138000",
      department: "dept-1",
      roles: [],
      enabled: true,
    });

    expect(revokeAll).not.toHaveBeenCalled();
  });

  it("records the operator as role assigner when updating roles", async () => {
    const service = createService();

    await service.update(
      {
        id: "user-1",
        username: "alice",
        phone: "13800138000",
        department: "dept-1",
        roles: ["role-1"],
        enabled: true,
      },
      "admin-1",
    );

    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: expect.objectContaining({
            create: [
              expect.objectContaining({
                assignedBy: { connect: { id: "admin-1" } },
                assignedAt: expect.any(Date),
              }),
            ],
          }),
        }),
      }),
    );
  });
});

describe("UserService uploadAvatar", () => {
  const userUpdate = jest.fn();
  const userFindUnique = jest.fn();
  const enqueue = jest.fn();

  const createService = () =>
    new UserService(
      new UserRepository({
        user: { update: userUpdate, findUnique: userFindUnique },
      }),
      { invalidateUsers: jest.fn() } as unknown as RbacPermissionCacheService,
      { revokeAll: jest.fn() } as unknown as SessionRevocationService,
      {
        get: () => "api/public",
      } as unknown as import("@nestjs/config").ConfigService,
      { enqueue } as unknown as FileCleanupService,
      {
        record: jest.fn(),
      } as unknown as import("@/core/logger/audit-log.service.js").AuditLogService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    userUpdate.mockResolvedValue({ id: "user-1" });
    userFindUnique.mockResolvedValue({ avatar: null });
    enqueue.mockResolvedValue(undefined);
  });

  it("updates avatar by user id and returns filePath", async () => {
    const service = createService();
    const file = {
      filename: "avatar.png",
      path: "/static-root/avatar/13800138000/avatar.png",
    } as Express.Multer.File;

    const result = await service.uploadAvatar(file, "user-1", "13800138000");

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatar: "api/public/avatar/13800138000/avatar.png" },
    });
    expect(enqueue).not.toHaveBeenCalled();
    expect(result).toEqual({
      filePath: "api/public/avatar/13800138000/avatar.png",
      message: "更新头像成功",
    });
  });

  it("enqueues the previous avatar after a successful replacement", async () => {
    userFindUnique.mockResolvedValue({
      avatar: "api/public/avatar/13800138000/old.png",
    });
    const service = createService();
    const file = {
      filename: "avatar.png",
      path: "/static-root/avatar/13800138000/avatar.png",
    } as Express.Multer.File;

    await service.uploadAvatar(file, "user-1", "13800138000");

    expect(enqueue).toHaveBeenCalledWith([
      { kind: "orphan-path", path: "/static-root/avatar/13800138000/old.png" },
    ]);
  });

  it("enqueues the new avatar file when the database update fails", async () => {
    userUpdate.mockRejectedValue(new Error("db down"));
    const service = createService();
    const file = {
      filename: "avatar.png",
      path: "/static-root/avatar/13800138000/avatar.png",
    } as Express.Multer.File;

    await expect(
      service.uploadAvatar(file, "user-1", "13800138000"),
    ).rejects.toThrow("db down");
    expect(enqueue).toHaveBeenCalledWith([
      {
        kind: "orphan-path",
        path: "/static-root/avatar/13800138000/avatar.png",
      },
    ]);
  });

  it("rejects missing user id", async () => {
    const service = createService();
    const file = { filename: "avatar.png" } as Express.Multer.File;

    await expect(service.uploadAvatar(file, "", "13800138000")).rejects.toThrow(
      "身份识别异常",
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });
});

describe("UserService role assignment", () => {
  const userCreate = jest.fn();
  const userFindUnique = jest.fn();
  const transaction = jest.fn(
    async (
      callback: (tx: {
        user: { create: typeof userCreate };
      }) => Promise<unknown>,
    ) => callback({ user: { create: userCreate } }),
  );

  const createService = () =>
    new UserService(
      new UserRepository({
        user: {
          create: userCreate,
          update: jest.fn(),
          findUnique: userFindUnique,
        },
        $transaction: transaction,
      }),
      { invalidateUsers: jest.fn() } as unknown as RbacPermissionCacheService,
      { revokeAll: jest.fn() } as unknown as SessionRevocationService,
      {
        get: () => "api/public",
      } as unknown as import("@nestjs/config").ConfigService,
      { enqueue: jest.fn() } as unknown as FileCleanupService,
      {
        record: jest.fn(),
      } as unknown as import("@/core/logger/audit-log.service.js").AuditLogService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    userFindUnique.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "user-2" });
  });

  it("records the operator as role assigner when creating a user", async () => {
    const service = createService();

    await service.addUser(
      {
        username: "bob",
        password: "ChangeMe_Now!",
        phone: "13900139000",
        department: "dept-1",
        roles: ["role-1"],
      },
      "admin-1",
    );

    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: {
            create: [
              expect.objectContaining({
                assignedBy: { connect: { id: "admin-1" } },
                assignedAt: expect.any(Date),
              }),
            ],
          },
        }),
      }),
    );
  });
});

describe("UserService list queries", () => {
  const findMany = jest.fn();
  const count = jest.fn();

  const createService = () =>
    new UserService(
      new UserRepository({
        user: { findMany, count, update: jest.fn(), findUnique: jest.fn() },
        $transaction: jest.fn(),
      }),
      { invalidateUsers: jest.fn() } as unknown as RbacPermissionCacheService,
      { revokeAll: jest.fn() } as unknown as SessionRevocationService,
      {
        get: () => "api/public",
      } as unknown as import("@nestjs/config").ConfigService,
      { enqueue: jest.fn() } as unknown as FileCleanupService,
      {
        record: jest.fn(),
      } as unknown as import("@/core/logger/audit-log.service.js").AuditLogService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads user list and count in parallel", async () => {
    let resolveList!: (value: unknown[]) => void;
    let resolveCount!: (value: number) => void;
    findMany.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    count.mockReturnValue(
      new Promise((resolve) => {
        resolveCount = resolve;
      }),
    );

    const pending = createService().findAll({
      pageIndex: 1,
      pageSize: 10,
      enabled: undefined,
    });

    expect(findMany).toHaveBeenCalled();
    expect(count).toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );

    resolveList([]);
    resolveCount(0);
    await expect(pending).resolves.toEqual({
      list: [],
      total: 0,
      message: "获取用户列表成功",
    });
  });

  it("returns a slim lookup page without phone or roles", async () => {
    findMany.mockResolvedValue([
      {
        id: "user-1",
        username: "alice",
        enabled: true,
        departmentId: "dept-1",
      },
    ]);
    count.mockResolvedValue(1);

    await expect(
      createService().lookupByDepartment({
        pageIndex: 1,
        pageSize: 10,
        id: undefined,
        enabled: true,
      }),
    ).resolves.toEqual({
      list: [
        {
          id: "user-1",
          username: "alice",
          enabled: true,
          departmentId: "dept-1",
        },
      ],
      total: 1,
      message: "用户选项查询成功",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, username: true, enabled: true, departmentId: true },
      }),
    );
  });
});
