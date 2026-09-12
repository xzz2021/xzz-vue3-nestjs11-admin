import {
  BackupStatus,
  BackupTrigger,
  Prisma,
} from '@/generated/prisma/client.js';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { Injectable } from '@nestjs/common';

import { DB_BACKUP_CONFIG_ID } from './db-backup.constants.js';
import type {
  BackupConfigFields,
  BackupExecutionResult,
} from './db-backup.types.js';

const JOB_LIST_INCLUDE = {
  createdBy: {
    select: {
      id: true,
      username: true,
    },
  },
} satisfies Prisma.DbBackupJobInclude;

@Injectable()
export class DbBackupRepository {
  constructor(private readonly db: PgService) {}

  getOrCreateConfig(defaults: BackupConfigFields) {
    return this.db.dbBackupConfig.upsert({
      where: { id: DB_BACKUP_CONFIG_ID },
      create: {
        id: DB_BACKUP_CONFIG_ID,
        ...defaults,
      },
      update: {},
    });
  }

  upsertConfig(input: BackupConfigFields) {
    return this.db.dbBackupConfig.upsert({
      where: { id: DB_BACKUP_CONFIG_ID },
      create: {
        id: DB_BACKUP_CONFIG_ID,
        ...input,
      },
      update: input,
    });
  }

  async findJobPage(query: {
    status?: BackupStatus;
    trigger?: BackupTrigger;
    skip: number;
    take: number;
  }) {
    const where: Prisma.DbBackupJobWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.trigger) where.trigger = query.trigger;

    const [total, list] = await Promise.all([
      this.db.dbBackupJob.count({ where }),
      this.db.dbBackupJob.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: JOB_LIST_INCLUDE,
      }),
    ]);
    return { total, list };
  }

  findJobById(id: string) {
    return this.db.dbBackupJob.findUnique({ where: { id } });
  }

  findRunningJobId() {
    return this.db.dbBackupJob.findFirst({
      where: { status: BackupStatus.RUNNING },
      select: { id: true },
    });
  }

  createRunningJob(data: {
    trigger: BackupTrigger;
    filePath: string;
    createdById?: string | null;
    startedAt: Date;
  }) {
    return this.db.dbBackupJob.create({
      data: {
        trigger: data.trigger,
        status: BackupStatus.RUNNING,
        fileName: 'pending',
        filePath: data.filePath,
        createdById: data.createdById ?? null,
        startedAt: data.startedAt,
      },
    });
  }

  markJobStarted(id: string, startedAt: Date) {
    return this.db.dbBackupJob.update({
      where: { id },
      data: { startedAt },
    });
  }

  failOrphanRunningJobs(finishedAt: Date, errorMessage: string) {
    return this.db.dbBackupJob.updateMany({
      where: { status: BackupStatus.RUNNING },
      data: {
        status: BackupStatus.FAILED,
        finishedAt,
        errorMessage,
      },
    });
  }

  finishSuccess(
    jobId: string,
    result: BackupExecutionResult,
    durationMs: number,
  ) {
    return this.db.$transaction([
      this.db.dbBackupJob.update({
        where: { id: jobId },
        data: {
          status: BackupStatus.SUCCESS,
          fileName: result.fileName,
          filePath: result.filePath,
          fileSize: result.fileSize,
          checksum: result.checksum,
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
          durationMs,
          errorMessage: null,
        },
      }),
      this.db.dbBackupConfig.update({
        where: { id: DB_BACKUP_CONFIG_ID },
        data: {
          lastRunAt: result.finishedAt,
          lastStatus: BackupStatus.SUCCESS,
          lastError: null,
        },
      }),
    ]);
  }

  finishFailure(jobId: string, startedAt: Date, message: string) {
    const finishedAt = new Date();
    return this.db.$transaction([
      this.db.dbBackupJob.update({
        where: { id: jobId },
        data: {
          status: BackupStatus.FAILED,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorMessage: message,
        },
      }),
      this.db.dbBackupConfig.update({
        where: { id: DB_BACKUP_CONFIG_ID },
        data: {
          lastRunAt: finishedAt,
          lastStatus: BackupStatus.FAILED,
          lastError: message.slice(0, 1000),
        },
      }),
    ]);
  }

  findSuccessFileRefs() {
    return this.db.dbBackupJob.findMany({
      where: { status: BackupStatus.SUCCESS },
      select: { id: true, filePath: true },
    });
  }

  findSuccessJobsNewestFirst() {
    return this.db.dbBackupJob.findMany({
      where: { status: BackupStatus.SUCCESS },
      orderBy: { createdAt: 'desc' },
    });
  }

  findExpiredFileRefs() {
    return this.db.dbBackupJob.findMany({
      where: { status: BackupStatus.EXPIRED },
      select: { id: true, filePath: true },
    });
  }

  markJobsExpired(ids: string[]) {
    if (!ids.length) return Promise.resolve({ count: 0 });
    return this.db.dbBackupJob.updateMany({
      where: { id: { in: ids } },
      data: { status: BackupStatus.EXPIRED },
    });
  }

  markJobExpired(id: string) {
    return this.db.dbBackupJob.update({
      where: { id },
      data: { status: BackupStatus.EXPIRED },
    });
  }

  markSuccessExpiredByPath(path: string) {
    return this.db.dbBackupJob.updateMany({
      where: { filePath: path, status: BackupStatus.SUCCESS },
      data: { status: BackupStatus.EXPIRED },
    });
  }

  deleteExpiredJob(id: string) {
    return this.db.dbBackupJob.deleteMany({
      where: { id, status: BackupStatus.EXPIRED },
    });
  }
}
