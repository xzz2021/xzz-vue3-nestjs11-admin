import type { ConfigService } from '@nestjs/config';

import { DbBackupConfigService } from './db-backup-config.service.js';
import { DbBackupRepository } from './db-backup.repository.js';
import type { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import type { Queue } from 'bullmq';

describe('DbBackupConfigService', () => {
  const queue = {
    getJobScheduler: vi.fn(),
    getRepeatableJobs: vi.fn(),
    removeRepeatableByKey: vi.fn(),
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
  };

  const pgService = {
    dbBackupConfig: {
      upsert: vi.fn(),
    },
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
      };
      return map[key];
    }),
  };

  const createSettings = () =>
    new DbBackupConfigService(
      new DbBackupRepository(pgService as unknown as PgService),
      configService as unknown as ConfigService,
      queue as unknown as Queue,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    pgService.dbBackupConfig.upsert.mockResolvedValue({
      enabled: true,
      cron: '0 0 * * * *',
      timezone: 'Asia/Shanghai',
      retentionMax: 24,
      filePrefix: 'backstage_db',
      gzip: true,
    });
    queue.getRepeatableJobs.mockResolvedValue([]);
  });

  it('skips schedule reset when cron and timezone are unchanged', async () => {
    queue.getJobScheduler.mockResolvedValue({
      pattern: '0 0 * * * *',
      tz: 'Asia/Shanghai',
      next: Date.now() + 3600_000,
    });

    await createSettings().syncSchedule();

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    expect(queue.removeJobScheduler).not.toHaveBeenCalledWith(
      'db-backup-scheduled',
    );
  });

  it('removes the legacy scheduler id on schedule sync', async () => {
    queue.getJobScheduler.mockResolvedValue({
      pattern: '0 0 * * * *',
      tz: 'Asia/Shanghai',
      next: Date.now() + 3600_000,
    });

    await createSettings().syncSchedule();

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(
      'db-backup:scheduled',
    );
  });

  it('upserts schedule when cron changes', async () => {
    queue.getJobScheduler.mockResolvedValue({
      pattern: '0 0 * * *',
      tz: 'Asia/Shanghai',
    });

    await createSettings().syncSchedule();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'db-backup-scheduled',
      { pattern: '0 0 * * * *', tz: 'Asia/Shanghai' },
      expect.objectContaining({
        name: 'scheduled',
        opts: expect.objectContaining({ attempts: 1 }),
      }),
    );
  });
});
