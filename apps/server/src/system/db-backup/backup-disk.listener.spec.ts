import { DiskCleanupEventBus } from "#/system/file-cleanup/disk-cleanup.events.js";
import { BackupDiskListener } from "./backup-disk.listener.js";
import type { DbBackupLifecycleService } from "./db-backup-lifecycle.service.js";

describe("BackupDiskListener", () => {
  const purgeExpired = jest.fn();
  const events = new DiskCleanupEventBus();
  const listener = new BackupDiskListener(events, {
    purgeExpired,
  } as unknown as DbBackupLifecycleService);

  beforeAll(() => {
    listener.onModuleInit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    purgeExpired.mockResolvedValue(undefined);
  });

  it("purges expired backup metadata after disk unlink", async () => {
    await events.emitUnlinked({
      kind: "backup-job",
      backupJobId: "job-1",
      path: "/backups/a.sql.gz",
    });
    expect(purgeExpired).toHaveBeenCalledWith("job-1");
  });

  it("ignores managed-file unlink events", async () => {
    await events.emitUnlinked({
      kind: "managed-file",
      fileId: 1,
      path: "a.png",
    });
    expect(purgeExpired).not.toHaveBeenCalled();
  });
});
