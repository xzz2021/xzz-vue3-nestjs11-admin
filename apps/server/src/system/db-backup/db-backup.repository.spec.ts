import { BackupStatus, BackupTrigger } from "#/prisma/generated/prisma/client.js";
import type { PgService } from "#/prisma/pg.service.js";
import { DbBackupRepository } from "./db-backup.repository.js";

describe("DbBackupRepository", () => {
  const db = {
    dbBackupConfig: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    dbBackupJob: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const repo = () => new DbBackupRepository(db);

  beforeEach(() => {
    jest.clearAllMocks();
    db.$transaction.mockImplementation(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    );
    db.dbBackupJob.update.mockResolvedValue({});
    db.dbBackupConfig.update.mockResolvedValue({});
  });

  it("writes job success and config last-run in one transaction", async () => {
    const finishedAt = new Date("2026-01-01T12:01:00.000Z");
    const startedAt = new Date("2026-01-01T12:00:00.000Z");

    await repo().finishSuccess(
      "job-1",
      {
        fileName: "a.sql.gz",
        filePath: "/backups/a.sql.gz",
        fileSize: 10n,
        checksum: "abc",
        startedAt,
        finishedAt,
      },
      1000,
    );

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.dbBackupJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: BackupStatus.SUCCESS,
        fileName: "a.sql.gz",
        durationMs: 1000,
        errorMessage: null,
      }),
    });
    expect(db.dbBackupConfig.update).toHaveBeenCalledWith({
      where: { id: "default" },
      data: {
        lastRunAt: finishedAt,
        lastStatus: BackupStatus.SUCCESS,
        lastError: null,
      },
    });
  });

  it("writes job failure and config last-run in one transaction", async () => {
    const startedAt = new Date("2026-01-01T12:00:00.000Z");

    await repo().finishFailure("job-1", startedAt, "pg_dump failed");

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.dbBackupJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: BackupStatus.FAILED,
        errorMessage: "pg_dump failed",
      }),
    });
    expect(db.dbBackupConfig.update).toHaveBeenCalledWith({
      where: { id: "default" },
      data: expect.objectContaining({
        lastStatus: BackupStatus.FAILED,
        lastError: "pg_dump failed",
      }),
    });
  });

  it("creates a running job with pending file placeholders", async () => {
    db.dbBackupJob.create.mockResolvedValue({ id: "job-1" });
    const startedAt = new Date();

    await repo().createRunningJob({
      trigger: BackupTrigger.MANUAL,
      filePath: "/backups/pending",
      createdById: "user-1",
      startedAt,
    });

    expect(db.dbBackupJob.create).toHaveBeenCalledWith({
      data: {
        trigger: BackupTrigger.MANUAL,
        status: BackupStatus.RUNNING,
        fileName: "pending",
        filePath: "/backups/pending",
        createdById: "user-1",
        startedAt,
      },
    });
  });

  it("does not issue an empty expired update", async () => {
    await repo().markJobsExpired([]);
    expect(db.dbBackupJob.updateMany).not.toHaveBeenCalled();
  });
});
