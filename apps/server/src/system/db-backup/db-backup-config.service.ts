import { BackupTrigger } from '@/generated/prisma/client.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { resolve } from 'node:path';

import { DbBackupRepository } from './db-backup.repository.js';
import {
  DB_BACKUP_DEFAULT_CRON,
  DB_BACKUP_DEFAULT_GZIP,
  DB_BACKUP_DEFAULT_PREFIX,
  DB_BACKUP_DEFAULT_RETENTION_MAX,
  DB_BACKUP_DEFAULT_TIMEZONE,
  DB_BACKUP_JOB_SCHEDULED,
  DB_BACKUP_LEGACY_SCHEDULER_IDS,
  DB_BACKUP_QUEUE,
  DB_BACKUP_SCHEDULED_SCHEDULER_ID,
} from './db-backup.constants.js';
import type {
  BackupConfigFields,
  BackupRuntimeConfig,
} from './db-backup.types.js';

@Injectable()
export class DbBackupConfigService {
  private readonly logger = new Logger(DbBackupConfigService.name);

  constructor(
    private readonly jobs: DbBackupRepository,
    private readonly configService: ConfigService,
    @InjectQueue(DB_BACKUP_QUEUE) private readonly queue: Queue,
  ) {}

  async getOrCreate() {
    return this.jobs.getOrCreateConfig(this.defaultConfig());
  }

  async upsert(input: BackupConfigFields) {
    return this.jobs.upsertConfig(input);
  }

  async getRuntime(): Promise<BackupRuntimeConfig> {
    const config = await this.getOrCreate();
    return {
      dir: resolve(this.getBackupDir()),
      enabled: config.enabled,
      cron: config.cron,
      timezone: config.timezone,
      retentionMax: config.retentionMax,
      filePrefix: config.filePrefix,
      gzip: config.gzip,
    };
  }

  getDatabaseUrl(): string {
    return (
      this.configService.get<string>('pgDatabaseUrl') ||
      this.configService.get<string>('PG_DATABASE_URL') ||
      ''
    );
  }

  /**
   * 同步定时备份调度：
   * - 关闭：按稳定 schedulerId 删除
   * - 开启且配置未变：不重设
   * - 开启且配置变化：upsertJobScheduler 幂等更新
   */
  async syncSchedule(): Promise<void> {
    await this.removeLegacyRepeatableJobs();

    const config = await this.getRuntime();
    if (!config.enabled) {
      await this.queue.removeJobScheduler(DB_BACKUP_SCHEDULED_SCHEDULER_ID);
      return;
    }

    const existing = await this.queue.getJobScheduler(
      DB_BACKUP_SCHEDULED_SCHEDULER_ID,
    );
    if (
      existing &&
      existing.pattern === config.cron &&
      (existing.tz || undefined) === (config.timezone || undefined)
    ) {
      return;
    }

    await this.queue.upsertJobScheduler(
      DB_BACKUP_SCHEDULED_SCHEDULER_ID,
      {
        pattern: config.cron,
        tz: config.timezone,
      },
      {
        name: DB_BACKUP_JOB_SCHEDULED,
        data: { trigger: BackupTrigger.SCHEDULED },
        opts: {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      },
    );
  }

  async getNextRunAt(): Promise<string | null> {
    const scheduler = await this.queue.getJobScheduler(
      DB_BACKUP_SCHEDULED_SCHEDULER_ID,
    );
    if (!scheduler?.next) return null;
    return new Date(scheduler.next).toISOString();
  }

  private defaultConfig(): BackupConfigFields {
    return {
      enabled: true,
      cron:
        this.configService.get<string>('dbBackup.cron') ||
        DB_BACKUP_DEFAULT_CRON,
      timezone:
        this.configService.get<string>('dbBackup.timezone') ||
        DB_BACKUP_DEFAULT_TIMEZONE,
      retentionMax:
        this.configService.get<number>('dbBackup.retentionMax') ||
        DB_BACKUP_DEFAULT_RETENTION_MAX,
      filePrefix:
        this.configService.get<string>('dbBackup.filePrefix') ||
        DB_BACKUP_DEFAULT_PREFIX,
      gzip:
        this.configService.get<boolean>('dbBackup.gzip') ??
        DB_BACKUP_DEFAULT_GZIP,
    };
  }

  private getBackupDir(): string {
    return (
      this.configService.get<string>('dbBackup.dir') ||
      this.configService.get<string>('DB_BACKUP_DIR') ||
      resolve(process.cwd(), 'backups')
    );
  }

  private async removeLegacyRepeatableJobs() {
    try {
      for (const legacyId of DB_BACKUP_LEGACY_SCHEDULER_IDS) {
        if (legacyId === DB_BACKUP_SCHEDULED_SCHEDULER_ID) continue;
        await this.queue.removeJobScheduler(legacyId);
      }

      const legacyJobs = await this.queue.getJobSchedulers();      
      for (const job of legacyJobs) {
        if (job.name !== DB_BACKUP_JOB_SCHEDULED) continue;
        if (job.key === DB_BACKUP_SCHEDULED_SCHEDULER_ID) continue;
        await this.queue.removeDeduplicationKey(job.key); // type error
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`清理旧版定时备份任务失败: ${message}`);
    }
  }
}
