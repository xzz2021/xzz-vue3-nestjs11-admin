import type { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import { promises as fs } from "node:fs";
import type { MockedFunction } from "vitest";
import { DiskCleanupEventBus } from "./disk-cleanup.events.js";
import { FILE_CLEANUP_UNLINK } from "./file-cleanup.constants.js";
import { FileCleanupService } from "./file-cleanup.service.js";

vi.mock("node:fs", () => ({
  promises: {
    unlink: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock("#/system/staticfile/multer.config.js", () => ({
  getStaticFileRoot: () => "/static-root",
  tryResolvePathInsideRoot: vi.fn((root: string, target: string) => {
    const normalizedRoot = root.replace(/\\/g, "/");
    const normalizedTarget = target.replace(/\\/g, "/");
    if (
      normalizedTarget.startsWith(`${normalizedRoot}/`) ||
      normalizedTarget === normalizedRoot
    ) {
      return target;
    }
    if (!target.startsWith("/") && !/^[A-Za-z]:/.test(target))
      return `${root}/${target}`;
    if (
      normalizedRoot.includes("backups") &&
      normalizedTarget.includes("backups")
    )
      return target;
    return null;
  }),
}));

describe("FileCleanupService", () => {
  const unlink = fs.unlink as MockedFunction<typeof fs.unlink>;
  const rm = fs.rm as MockedFunction<typeof fs.rm>;
  const queueAdd = vi.fn();
  const findUnique = vi.fn();

  const createService = () => {
    const events = new DiskCleanupEventBus();
    const service = new FileCleanupService(
      {
        get: (key: string) => (key === "dbBackup.dir" ? "/backups" : undefined),
      } as unknown as ConfigService,
      { add: queueAdd } as any as Queue,
      events,
      { file: { findUnique } } as any,
    );
    return { service, events };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    unlink.mockResolvedValue(undefined);
    rm.mockResolvedValue(undefined);
    queueAdd.mockResolvedValue({});
    findUnique.mockResolvedValue({ deletedAt: new Date() });
  });

  it("enqueues unlink jobs without touching the filesystem", async () => {
    const { service } = createService();
    await service.enqueue([
      { kind: "managed-file", fileId: 1, path: "a.png" },
      { kind: "orphan-path", path: "/static-root/old.png" },
    ]);

    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(queueAdd).toHaveBeenCalledWith(
      FILE_CLEANUP_UNLINK,
      { kind: "managed-file", fileId: 1, path: "a.png" },
      expect.objectContaining({ attempts: 5 }),
    );
    expect(unlink).not.toHaveBeenCalled();
  });

  it("unlinks then emits disk.unlinked without touching file metadata", async () => {
    const { service, events } = createService();
    const onUnlinked = vi.fn();
    events.onUnlinked(onUnlinked);

    await service.process({ kind: "managed-file", fileId: 9, path: "a.png" });

    expect(unlink).toHaveBeenCalledWith("/static-root/a.png");
    expect(onUnlinked).toHaveBeenCalledWith({
      kind: "managed-file",
      fileId: 9,
      path: "a.png",
    });
  });

  it("retries when unlink fails for a reason other than missing file", async () => {
    const { service, events } = createService();
    unlink.mockRejectedValue(
      Object.assign(new Error("busy"), { code: "EBUSY" }),
    );
    const onUnlinked = vi.fn();
    events.onUnlinked(onUnlinked);

    await expect(
      service.process({ kind: "orphan-path", path: "a.png" }),
    ).rejects.toThrow("busy");
    expect(onUnlinked).not.toHaveBeenCalled();
  });

  it("treats missing files as success and still emits unlinked for backup jobs", async () => {
    const { service, events } = createService();
    unlink.mockRejectedValue(
      Object.assign(new Error("gone"), { code: "ENOENT" }),
    );
    const onUnlinked = vi.fn();
    events.onUnlinked(onUnlinked);

    await service.process({
      kind: "backup-job",
      backupJobId: "job-1",
      path: "/backups/a.sql.gz",
    });

    expect(unlink).toHaveBeenCalledWith("/backups/a.sql.gz");
    expect(onUnlinked).toHaveBeenCalledWith({
      kind: "backup-job",
      backupJobId: "job-1",
      path: "/backups/a.sql.gz",
    });
  });

  it("skips managed-file unlink when the file has been restored", async () => {
    const { service, events } = createService();
    findUnique.mockResolvedValue({ deletedAt: null });
    const onUnlinked = vi.fn();
    events.onUnlinked(onUnlinked);

    await service.process({ kind: "managed-file", fileId: 9, path: "a.png" });

    expect(unlink).not.toHaveBeenCalled();
    expect(onUnlinked).not.toHaveBeenCalled();
  });

  it("recursively removes upload session temp directories", async () => {
    const { service, events } = createService();
    const onUnlinked = vi.fn();
    events.onUnlinked(onUnlinked);

    await service.process({
      kind: "upload-session",
      sessionId: "sess-1",
      path: "file/tmp/sess-1",
    });

    expect(rm).toHaveBeenCalledWith("/static-root/file/tmp/sess-1", {
      recursive: true,
      force: true,
    });
    expect(unlink).not.toHaveBeenCalled();
    expect(onUnlinked).toHaveBeenCalledWith({
      kind: "upload-session",
      sessionId: "sess-1",
      path: "file/tmp/sess-1",
    });
  });
});
