import { BackupStatus, BackupTrigger } from '#/generated/prisma/client.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { MessageDeliveryService } from '../message/message-delivery.service.js';
import { DbBackupConfigService } from './db-backup-config.service.js';
import { DbBackupLifecycleService } from './db-backup-lifecycle.service.js';
import {
  DB_BACKUP_ALERT_DEBOUNCE_SEC,
  DB_BACKUP_ALERT_KEY,
  DB_BACKUP_JOB_RUN,
  DB_BACKUP_LOCK_KEY,
  DB_BACKUP_LOCK_TTL_MS,
  DB_BACKUP_MANUAL_JOB_ID,
  DB_BACKUP_MAX_PAGE_SIZE,
  DB_BACKUP_QUEUE,
  DB_BACKUP_RELEASE_LOCK_LUA,
} from './db-backup.constants.js';
import { DbBackupRepository } from './db-backup.repository.js';
import type {
  BackupConfigPayload,
  BackupJobListItem,
  BackupJobQuery,
  DbBackupQueueJob,
} from './db-backup.types.js';
import { PgDumpRunner } from './pg-dump.runner.js';

@Injectable()
export class DbBackupService implements OnModuleInit {
  private readonly logger = new Logger(DbBackupService.name);
  private readonly redis: Redis;

  constructor(
    private readonly jobs: DbBackupRepository,
    private readonly settings: DbBackupConfigService,
    private readonly pgDumpRunner: PgDumpRunner,
    private readonly lifecycle: DbBackupLifecycleService,
    redisService: RedisService,
    @InjectQueue(DB_BACKUP_QUEUE) private readonly queue: Queue,
    @Optional() private readonly messageDelivery?: MessageDeliveryService,
  ) {
    this.redis = redisService.getOrThrow('default');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.failOrphanRunningJobs();
      await this.lifecycle.reconcile();
      await this.settings.syncSchedule();
    } catch (error) {
      this.logger.warn(
        `备份调度初始化跳过: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getConfigPayload(): Promise<BackupConfigPayload> {
    const [config, nextRunAt] = await Promise.all([
      this.settings.getOrCreate(),
      this.settings.getNextRunAt(),
    ]);
    return {
      ...config,
      nextRunAt,
      message: '获取备份配置成功',
    };
  }

  async updateConfig(input: {
    enabled: boolean;
    cron: string;
    timezone: string;
    retentionMax: number;
    filePrefix: string;
    gzip: boolean;
  }) {
    const config = await this.settings.upsert(input);
    await this.settings.syncSchedule();
    return {
      ...config,
      nextRunAt: await this.settings.getNextRunAt(),
      message: '备份配置已更新',
    };
  }

  async getRuntimeConfig() {
    return this.settings.getRuntime();
  }

  async syncSchedule() {
    return this.settings.syncSchedule();
  }

  async listJobs(query: BackupJobQuery) {
    const pageIndex = Math.max(1, query.pageIndex ?? 1);
    const pageSize = Math.min(
      DB_BACKUP_MAX_PAGE_SIZE,
      Math.max(1, query.pageSize ?? 10),
    );
    const { total, list } = await this.jobs.findJobPage({
      status: query.status,
      trigger: query.trigger,
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
    });

    return {
      total,
      list: list.map((item) => this.serializeJob(item)),
      pageIndex,
      pageSize,
      message: '获取备份任务列表成功',
    };
  }

  async getJobFile(id: string) {
    const job = await this.jobs.findJobById(id);
    if (!job) {
      throw new NotFoundException('备份任务不存在');
    }
    if (
      job.status !== BackupStatus.SUCCESS &&
      job.status !== BackupStatus.EXPIRED
    ) {
      throw new ConflictException('该备份尚未生成可下载文件');
    }
    await this.lifecycle.assertFileExists(job.filePath);
    if (job.status === BackupStatus.EXPIRED) {
      throw new NotFoundException('备份文件已失效');
    }
    return job;
  }

  async deleteJob(id: string) {
    const job = await this.jobs.findJobById(id);
    if (!job) {
      throw new NotFoundException('备份任务不存在');
    }
    if (job.status === BackupStatus.RUNNING) {
      throw new ConflictException('备份任务执行中，无法删除');
    }
    await this.lifecycle.expireAndEnqueue(job);
    return { message: '备份任务已删除' };
  }

  async cleanup() {
    const config = await this.settings.getRuntime();
    const removed = await this.lifecycle.applyRetention(config.retentionMax);
    return { count: removed, message: `已清理 ${removed} 个历史备份` };
  }

  async reconcile(): Promise<number> {
    return this.lifecycle.reconcile();
  }

  /** 手动备份：固定 jobId 幂等入队，队列中已有则拒绝 */
  async enqueueBackup(trigger: BackupTrigger, userId?: string | null) {
    await this.assertNoActiveJob();
    await this.assertManualJobIdle();

    const job = await this.createRunningJob(trigger, userId);
    const payload: DbBackupQueueJob = { dbJobId: job.id, trigger };

    let queued: Job<DbBackupQueueJob>;
    try {
      queued = await this.queue.add(DB_BACKUP_JOB_RUN, payload, {
        jobId: DB_BACKUP_MANUAL_JOB_ID,
        attempts: 1,
        // 完成后立刻释放幂等 jobId，避免挡住下一次手动备份
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch (error) {
      await this.jobs.finishFailure(
        job.id,
        job.startedAt,
        getErrorMessage(error),
      );
      throw new ConflictException(
        `备份任务入队失败: ${getErrorMessage(error)}`,
      );
    }

    // jobId 已存在时 BullMQ 不报错而是返回旧任务，此时新记录不会被消费，需回滚为失败
    if (queued.data?.dbJobId !== job.id) {
      await this.jobs.finishFailure(
        job.id,
        job.startedAt,
        '已有手动备份任务在队列中',
      );
      throw new ConflictException('已有手动备份任务在队列中，请稍后再试');
    }

    return { id: job.id, message: '备份任务已加入队列' };
  }

  /** 定时任务触发：在 Processor 内创建记录并执行 */
  async executeBackup(trigger: BackupTrigger, userId?: string | null) {
    await this.assertNoActiveJob();
    const job = await this.createRunningJob(trigger, userId);
    await this.performBackup(job.id);
  }

  /** 手动任务消费：按已有记录执行 */
  async executeBackupJob(dbJobId: string) {
    await this.performBackup(dbJobId);
  }

  private async performBackup(dbJobId: string) {
    const job = await this.jobs.findJobById(dbJobId);
    if (!job) {
      throw new NotFoundException('备份任务不存在');
    }
    if (job.status !== BackupStatus.RUNNING) {
      this.logger.warn(
        `跳过非 RUNNING 状态的备份任务 id=${dbJobId} status=${job.status}`,
      );
      return;
    }

    const token = randomUUID();
    await this.acquireLock(token);
    const runtimeConfig = await this.settings.getRuntime();
    const startedAt = new Date();

    try {
      await this.jobs.markJobStarted(dbJobId, startedAt);
      const result = await this.pgDumpRunner.run(
        runtimeConfig,
        this.settings.getDatabaseUrl(),
      );
      const durationMs =
        result.finishedAt.getTime() - result.startedAt.getTime();
      await this.jobs.finishSuccess(dbJobId, result, durationMs);
      await this.lifecycle.applyRetention(runtimeConfig.retentionMax);
    } catch (error) {
      const message = getErrorMessage(error);
      await this.jobs.finishFailure(dbJobId, startedAt, message);
      await this.sendFailureAlert(message);
      throw error;
    } finally {
      await this.releaseLock(token);
    }
  }

  private async createRunningJob(
    trigger: BackupTrigger,
    userId?: string | null,
  ) {
    const runtimeConfig = await this.settings.getRuntime();
    const startedAt = new Date();
    return this.jobs.createRunningJob({
      trigger,
      filePath: resolve(runtimeConfig.dir, 'pending'),
      createdById: userId ?? null,
      startedAt,
    });
  }

  private async assertNoActiveJob() {
    const active = await this.jobs.findRunningJobId();
    if (active) {
      throw new ConflictException('已有备份任务正在执行，请稍后再试');
    }
  }

  /** 手动备份幂等：队列中仍存在同 jobId 时拒绝重复入队 */
  private async assertManualJobIdle() {
    const existing = await this.queue.getJob(DB_BACKUP_MANUAL_JOB_ID);
    if (!existing) return;

    const state = await existing.getState();
    if (state === 'completed' || state === 'failed') {
      await existing.remove();
      return;
    }

    throw new ConflictException('已有手动备份任务在队列中，请稍后再试');
  }

  private async failOrphanRunningJobs() {
    const finishedAt = new Date();
    const result = await this.jobs.failOrphanRunningJobs(
      finishedAt,
      '服务重启，备份中断',
    );
    if (result.count > 0) {
      this.logger.warn(`已将 ${result.count} 个中断的备份任务标记为失败`);
    }
  }

  private async sendFailureAlert(message: string) {
    if (!this.messageDelivery) return;
    try {
      await this.messageDelivery.enqueueAlertDebounced(
        DB_BACKUP_ALERT_KEY,
        {
          title: '数据库备份失败',
          content: message,
          meta: { source: 'db-backup' },
        },
        DB_BACKUP_ALERT_DEBOUNCE_SEC,
      );
    } catch (error) {
      this.logger.warn(`发送备份失败告警失败: ${getErrorMessage(error)}`);
    }
  }

  private async acquireLock(token: string) {
    const ok = await this.redis.set(
      DB_BACKUP_LOCK_KEY,
      token,
      'PX',
      DB_BACKUP_LOCK_TTL_MS,
      'NX',
    );
    if (ok !== 'OK') {
      throw new ConflictException('已有备份任务正在执行，请稍后再试');
    }
  }

  private async releaseLock(token: string) {
    try {
      await this.redis.eval(
        DB_BACKUP_RELEASE_LOCK_LUA,
        1,
        DB_BACKUP_LOCK_KEY,
        token,
      );
    } catch (error) {
      this.logger.warn(`释放备份锁失败: ${getErrorMessage(error)}`);
    }
  }

  private serializeJob(item: BackupJobListItem) {
    return {
      ...item,
      fileSize: item.fileSize == null ? null : item.fileSize.toString(),
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
