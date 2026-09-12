import {
  logRedisConnectFailure,
  redisTargetFromEnv,
} from '#/infrastructure/database/redis/redis-connection.log.js';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { BackupTrigger } from '#/generated/prisma/client.js';

import {
  DB_BACKUP_JOB_RUN,
  DB_BACKUP_JOB_SCHEDULED,
  DB_BACKUP_QUEUE,
} from './db-backup.constants.js';
import { DbBackupService } from './db-backup.service.js';
import type { DbBackupQueueJob } from './db-backup.types.js';

@Processor(DB_BACKUP_QUEUE, { concurrency: 1 })
export class DbBackupProcessor extends WorkerHost {
  private readonly logger = new Logger(DbBackupProcessor.name);

  constructor(private readonly dbBackupService: DbBackupService) {
    super();
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error) {
    logRedisConnectFailure(this.logger, redisTargetFromEnv(), error);
  }

  async process(
    job: Job<DbBackupQueueJob | { trigger?: BackupTrigger }>,
  ): Promise<void> {
    if (job.name === DB_BACKUP_JOB_SCHEDULED) {
      await this.dbBackupService.executeBackup(BackupTrigger.SCHEDULED);
      return;
    }

    if (job.name === DB_BACKUP_JOB_RUN) {
      const data = job.data as DbBackupQueueJob;
      if (!data.dbJobId) {
        this.logger.error(`备份任务缺少 dbJobId job=${job.id}`);
        return;
      }
      await this.dbBackupService.executeBackupJob(data.dbJobId);
      return;
    }

    this.logger.warn(`忽略未知备份任务类型 name=${job.name} id=${job.id}`);
  }
}
