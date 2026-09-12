import { DiskCleanupEventBus } from "@/system/file-cleanup/disk-cleanup.events.js";
import type { FileCleanupJob } from "@/system/file-cleanup/file-cleanup.types.js";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { StaticfileService } from "./staticfile.service.js";

@Injectable()
export class StaticfileDiskListener implements OnModuleInit {
  constructor(
    private readonly events: DiskCleanupEventBus,
    private readonly staticfiles: StaticfileService,
  ) {}

  onModuleInit(): void {
    this.events.onUnlinked((job) => this.onUnlinked(job));
  }

  private async onUnlinked(job: FileCleanupJob): Promise<void> {
    if (job.kind !== "managed-file") return;
    await this.staticfiles.purgeAfterUnlink(job.fileId);
  }
}
