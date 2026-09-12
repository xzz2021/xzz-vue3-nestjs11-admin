import { DiskCleanupEventBus } from "@/system/file-cleanup/disk-cleanup.events.js";
import type { StaticfileService } from "./staticfile.service.js";
import { StaticfileDiskListener } from "./staticfile-disk.listener.js";

describe("StaticfileDiskListener", () => {
  const purgeAfterUnlink = jest.fn();
  const events = new DiskCleanupEventBus();
  const listener = new StaticfileDiskListener(events, {
    purgeAfterUnlink,
  } as unknown as StaticfileService);

  beforeAll(() => {
    listener.onModuleInit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    purgeAfterUnlink.mockResolvedValue(undefined);
  });

  it("purges soft-deleted file metadata after disk unlink", async () => {
    await events.emitUnlinked({
      kind: "managed-file",
      fileId: 9,
      path: "a.png",
    });
    expect(purgeAfterUnlink).toHaveBeenCalledWith(9);
  });

  it("ignores backup and orphan unlink events", async () => {
    await events.emitUnlinked({ kind: "orphan-path", path: "a.png" });
    await events.emitUnlinked({
      kind: "backup-job",
      backupJobId: "job-1",
      path: "/backups/a.sql.gz",
    });
    expect(purgeAfterUnlink).not.toHaveBeenCalled();
  });
});
