import type { PgService } from "#/prisma/pg.service.js";
import type { FileCleanupService } from "#/system/file-cleanup/file-cleanup.service.js";
import { FileRepository } from "./file.repository.js";
import { StaticfileService } from "./staticfile.service.js";

describe("StaticfileService", () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const create = jest.fn();
  const updateMany = jest.fn();
  const deleteMany = jest.fn();
  const enqueue = jest.fn();

  const service = new StaticfileService(
    new FileRepository({
      file: { findMany, count, create, updateMany, deleteMany },
    }),
    { enqueue } as unknown as FileCleanupService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    enqueue.mockResolvedValue(undefined);
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("loads active file list and count in parallel", async () => {
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

    const pending = service.getFileList();

    expect(findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(count).toHaveBeenCalledWith({ where: { deletedAt: null } });

    resolveList([]);
    resolveCount(0);
    await expect(pending).resolves.toEqual({
      message: "文件列表获取成功",
      list: [],
      total: 0,
    });
  });

  it("serializes bigint file size as a JSON-safe number", async () => {
    findMany.mockResolvedValue([
      { id: 1, path: "/static-root/a.bin", size: 3_000_000_000n },
    ]);
    count.mockResolvedValue(1);

    await expect(service.getFileList()).resolves.toEqual({
      message: "文件列表获取成功",
      list: [{ id: 1, path: "/static-root/a.bin", size: 3_000_000_000 }],
      total: 1,
    });
  });

  it("marks files deleted and enqueues cleanup instead of unlinking in the request", async () => {
    findMany.mockResolvedValue([{ id: 1, path: "/static-root/a.png" }]);

    await service.deleteFile([1]);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(enqueue).toHaveBeenCalledWith([
      { kind: "managed-file", fileId: 1, path: "/static-root/a.png" },
    ]);
  });

  it("enqueues the uploaded file for cleanup when the database write fails", async () => {
    create.mockRejectedValue(new Error("db down"));

    await expect(
      service.uploadFile({
        name: "a.png",
        mimeType: "image/png",
        path: "/static-root/a.png",
        size: 10,
        url: "http://localhost/a.png",
        extension: "png",
      }),
    ).rejects.toThrow("db down");
    expect(enqueue).toHaveBeenCalledWith([
      { kind: "orphan-path", path: "/static-root/a.png" },
    ]);
  });

  it("re-enqueues soft-deleted files during startup reconcile", async () => {
    findMany.mockResolvedValue([{ id: 2, path: "b.png" }]);

    await service.reconcilePendingCleanup();

    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: { not: null } },
      select: { id: true, path: true },
    });
    expect(enqueue).toHaveBeenCalledWith([
      { kind: "managed-file", fileId: 2, path: "b.png" },
    ]);
  });

  it("hard-deletes only already soft-deleted metadata after unlink", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    await service.purgeAfterUnlink(9);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 9, deletedAt: { not: null } },
    });
  });
});
