import type { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";

import { DbBackupConfigService } from "./db-backup-config.service.js";
import { DbBackupRepository } from "./db-backup.repository.js";

describe("DbBackupConfigService", () => {
  const queue = {
    getJobScheduler: jest.fn(),
    getRepeatableJobs: jest.fn(),
    removeRepeatableByKey: jest.fn(),
    upsertJobScheduler: jest.fn(),
    removeJobScheduler: jest.fn(),
  };

  const pgService = {
    dbBackupConfig: {
      upsert: jest.fn(),
    },
  };

  const configService = {
    get: jest.fn((key: string) => {
      const map: Record<string, unknown> = {
        "dbBackup.dir": "backups",
        "dbBackup.cron": "0 0 * * * *",
        "dbBackup.timezone": "Asia/Shanghai",
        "dbBackup.retentionMax": 24,
        "dbBackup.filePrefix": "backstage_db",
        "dbBackup.gzip": true,
      };
      return map[key];
    }),
  };

  const createSettings = () =>
    new DbBackupConfigService(
      new DbBackupRepository(pgService),
      configService as unknown as ConfigService,
      queue,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    pgService.dbBackupConfig.upsert.mockResolvedValue({
      enabled: true,
      cron: "0 0 * * * *",
      timezone: "Asia/Shanghai",
      retentionMax: 24,
      filePrefix: "backstage_db",
      gzip: true,
    });
    queue.getRepeatableJobs.mockResolvedValue([]);
  });

  it("skips schedule reset when cron and timezone are unchanged", async () => {
    queue.getJobScheduler.mockResolvedValue({
      pattern: "0 0 * * * *",
      tz: "Asia/Shanghai",
      next: Date.now() + 3600_000,
    });

    await createSettings().syncSchedule();

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    expect(queue.removeJobScheduler).not.toHaveBeenCalledWith(
      "db-backup-scheduled",
    );
  });

  it("removes the legacy scheduler id on schedule sync", async () => {
    queue.getJobScheduler.mockResolvedValue({
      pattern: "0 0 * * * *",
      tz: "Asia/Shanghai",
      next: Date.now() + 3600_000,
    });

    await createSettings().syncSchedule();

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(
      "db-backup:scheduled",
    );
  });

  it("upserts schedule when cron changes", async () => {
    queue.getJobScheduler.mockResolvedValue({
      pattern: "0 0 * * *",
      tz: "Asia/Shanghai",
    });

    await createSettings().syncSchedule();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      "db-backup-scheduled",
      { pattern: "0 0 * * * *", tz: "Asia/Shanghai" },
      expect.objectContaining({
        name: "scheduled",
        opts: expect.objectContaining({ attempts: 1 }),
      }),
    );
  });
});
