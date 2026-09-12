import { BackupStatus } from "@/generated/prisma/client.js";
import { FileCleanupService } from "@/system/file-cleanup/file-cleanup.service.js";
import { Injectable, NotFoundException } from "@nestjs/common";
import { promises as fs } from "node:fs";

import { DbBackupRepository } from "./db-backup.repository.js";

@Injectable()
export class DbBackupLifecycleService {
  constructor(
    private readonly jobs: DbBackupRepository,
    private readonly fileCleanupService: FileCleanupService,
  ) {}

  async reconcile(): Promise<number> {
    const jobs = await this.jobs.findSuccessFileRefs();
    const expiredIds: string[] = [];
    for (const job of jobs) {
      try {
        await fs.access(job.filePath);
      } catch {
        expiredIds.push(job.id);
      }
    }

    if (expiredIds.length) {
      await this.jobs.markJobsExpired(expiredIds);
    }
    await this.enqueueExpiredJobs();
    return expiredIds.length;
  }

  async applyRetention(retentionMax: number): Promise<number> {
    const successJobs = await this.jobs.findSuccessJobsNewestFirst();
    const removable = successJobs.slice(Math.max(retentionMax, 0));
    if (!removable.length) return 0;
    await this.jobs.markJobsExpired(removable.map((item) => item.id));
    await this.fileCleanupService.enqueue(
      removable.map((job) => ({
        kind: "backup-job" as const,
        backupJobId: job.id,
        path: job.filePath,
      })),
    );
    return removable.length;
  }

  async expireAndEnqueue(job: {
    id: string;
    filePath: string;
    status: BackupStatus;
  }): Promise<void> {
    if (job.status !== BackupStatus.EXPIRED) {
      await this.jobs.markJobExpired(job.id);
    }
    await this.enqueueCleanup(job);
  }

  async enqueueCleanup(job: { id: string; filePath: string }): Promise<void> {
    await this.fileCleanupService.enqueue([
      { kind: "backup-job", backupJobId: job.id, path: job.filePath },
    ]);
  }

  async purgeExpired(backupJobId: string): Promise<void> {
    await this.jobs.deleteExpiredJob(backupJobId);
  }

  private async enqueueExpiredJobs(): Promise<void> {
    const expired = await this.jobs.findExpiredFileRefs();
    await this.fileCleanupService.enqueue(
      expired.map((item) => ({
        kind: "backup-job" as const,
        backupJobId: item.id,
        path: item.filePath,
      })),
    );
  }

  async assertFileExists(path: string): Promise<void> {
    try {
      await fs.access(path);
    } catch {
      await this.jobs.markSuccessExpiredByPath(path);
      throw new NotFoundException("备份文件不存在或已失效");
    }
  }
}
