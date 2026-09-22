import { ConflictException, NotFoundException } from '@nestjs/common';

import { BackupStatus, BackupTrigger } from '#/generated/prisma/client.js';
import type { RedisService } from '@liaoliaots/nestjs-redis';
import type { ConfigService } from '@nestjs/config';

import type { FileCleanupService } from '#/system/file-cleanup/file-cleanup.service.js';
import { DbBackupConfigService } from './db-backup-config.service.js';
import { DbBackupLifecycleService } from './db-backup-lifecycle.service.js';
import { DbBackupRepository } from './db-backup.repository.js';
import { DbBackupService } from './db-backup.service.js';

describe('DbBackupService', () => {
  const redis = {
    set: vi.fn(),
    eval: vi.fn(),
  };

  const queue = {
    add: vi.fn(),
    getJob: vi.fn(),
    getJobScheduler: vi.fn(),
    getJobSchedulers: vi.fn(),
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
  };

  const pgService = {
    dbBackupConfig: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    dbBackupJob: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const configService = {
    get: vi.fn((key: string) => {
      const map: Record<string, unknown> = {
        'dbBackup.dir': 'backups',
        'dbBackup.cron': '0 0 * * * *',
        'dbBackup.timezone': 'Asia/Shanghai',
        'dbBackup.retentionMax': 24,
        'dbBackup.filePrefix': 'backstage_db',
        'dbBackup.gzip': true,
        pgDatabaseUrl: 'postgresql://user:pass@localhost:5432/app',
      };
      return map[key];
    }),
  };

  const pgDumpRunner = {
    run: vi.fn(),
  };

  const fileCleanup = {
    enqueue: vi.fn(),
  };

  const createService = () => {
    const jobs = new DbBackupRepository(pgService as any);
    const settings = new DbBackupConfigService(
      jobs,
      configService as unknown as ConfigService,
      queue as any,
    );
    const lifecycle = new DbBackupLifecycleService(
      jobs,
      fileCleanup as unknown as FileCleanupService,
    );
    return new DbBackupService(
      jobs,
      settings,
      pgDumpRunner as any,
      lifecycle,
      { getOrThrow: () => redis } as unknown as RedisService,
      queue as any,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    pgService.dbBackupConfig.upsert.mockResolvedValue({
      id: 'default',
      enabled: true,
      cron: '0 0 * * * *',
      timezone: 'Asia/Shanghai',
      retentionMax: 24,
      filePrefix: 'backstage_db',
      gzip: true,
      lastRunAt: null,
      lastStatus: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    pgService.dbBackupJob.findFirst.mockResolvedValue(null);
    queue.getJob.mockResolvedValue(null);
    queue.getJobScheduler.mockResolvedValue(null);
    queue.getJobSchedulers.mockResolvedValue([]);
  });

  it('serializes bigint file size in job list', async () => {
    const service = createService();
    pgService.dbBackupJob.count.mockResolvedValue(1);
    pgService.dbBackupJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        trigger: BackupTrigger.MANUAL,
        status: BackupStatus.SUCCESS,
        fileName: 'backup.sql.gz',
        filePath: '/tmp/backup.sql.gz',
        fileSize: 1024n,
        checksum: 'abc',
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 1000,
        errorMessage: null,
        createdById: 'user-1',
        createdBy: { id: 'user-1', username: 'admin' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.listJobs({ pageIndex: 1, pageSize: 10 });

    expect(result.list[0]?.fileSize).toBe('1024');
  });

  it('enqueues a manual backup with stable idempotent jobId', async () => {
    const service = createService();
    const startedAt = new Date();
    pgService.dbBackupJob.create.mockResolvedValue({
      id: 'job-1',
      startedAt,
    });
    queue.add.mockResolvedValue({
      id: 'db-backup-manual',
      data: { dbJobId: 'job-1', trigger: BackupTrigger.MANUAL },
    });

    const result = await service.enqueueBackup(BackupTrigger.MANUAL, 'user-1');

    expect(result).toEqual({ id: 'job-1', message: '备份任务已加入队列' });
    expect(queue.add).toHaveBeenCalledWith(
      'run',
      { dbJobId: 'job-1', trigger: BackupTrigger.MANUAL },
      expect.objectContaining({
        jobId: 'db-backup-manual',
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
    expect(pgDumpRunner.run).not.toHaveBeenCalled();
  });

  it('rejects enqueue when bullmq returns an existing job for the same jobId', async () => {
    const service = createService();
    pgService.dbBackupJob.create.mockResolvedValue({
      id: 'job-2',
      startedAt: new Date(),
    });
    pgService.$transaction.mockResolvedValue([]);
    queue.add.mockResolvedValue({
      id: 'db-backup-manual',
      data: { dbJobId: 'job-1', trigger: BackupTrigger.MANUAL },
    });

    await expect(
      service.enqueueBackup(BackupTrigger.MANUAL, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(pgService.$transaction).toHaveBeenCalled();
  });

  it('rejects enqueue when another backup is running', async () => {
    const service = createService();
    pgService.dbBackupJob.findFirst.mockResolvedValue({ id: 'running-job' });

    await expect(
      service.enqueueBackup(BackupTrigger.MANUAL, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects enqueue when manual job already exists in queue', async () => {
    const service = createService();
    queue.getJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('waiting'),
      remove: vi.fn(),
    });

    await expect(
      service.enqueueBackup(BackupTrigger.MANUAL, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('marks a backup expired and enqueues cleanup instead of unlinking in the request', async () => {
    const service = createService();
    pgService.dbBackupJob.findUnique.mockResolvedValue({
      id: 'job-1',
      status: BackupStatus.SUCCESS,
      filePath: '/backups/a.sql.gz',
    });
    pgService.dbBackupJob.update.mockResolvedValue({});
    fileCleanup.enqueue.mockResolvedValue(undefined);

    await service.deleteJob('job-1');

    expect(pgService.dbBackupJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: BackupStatus.EXPIRED },
    });
    expect(fileCleanup.enqueue).toHaveBeenCalledWith([
      { kind: 'backup-job', backupJobId: 'job-1', path: '/backups/a.sql.gz' },
    ]);
    expect(pgService.dbBackupJob.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting a running backup job', async () => {
    const service = createService();
    pgService.dbBackupJob.findUnique.mockResolvedValue({
      id: 'job-1',
      status: BackupStatus.RUNNING,
      filePath: '/backups/a.sql.gz',
    });

    await expect(service.deleteJob('job-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(fileCleanup.enqueue).not.toHaveBeenCalled();
  });

  it('rejects deleting a missing backup job', async () => {
    const service = createService();
    pgService.dbBackupJob.findUnique.mockResolvedValue(null);

    await expect(service.deleteJob('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
