import { DiskCleanupEventBus } from "@/system/file-cleanup/disk-cleanup.events.js";
import type { FileCleanupJob } from "@/system/file-cleanup/file-cleanup.types.js";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { DbBackupLifecycleService } from "./db-backup-lifecycle.service.js";

@Injectable()
export class BackupDiskListener implements OnModuleInit {
  constructor(
    private readonly events: DiskCleanupEventBus,
    private readonly lifecycle: DbBackupLifecycleService,
  ) {}

  onModuleInit(): void {
    this.events.onUnlinked((job) => this.onUnlinked(job));
  }

  private async onUnlinked(job: FileCleanupJob): Promise<void> {
    if (job.kind !== "backup-job") return;
    await this.lifecycle.purgeExpired(job.backupJobId);
  }
}
