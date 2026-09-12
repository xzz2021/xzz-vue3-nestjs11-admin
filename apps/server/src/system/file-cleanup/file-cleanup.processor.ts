import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import {
  FILE_CLEANUP_QUEUE,
  FILE_CLEANUP_UNLINK,
} from "./file-cleanup.constants.js";
import { FileCleanupService } from "./file-cleanup.service.js";
import type { FileCleanupJob } from "./file-cleanup.types.js";

@Processor(FILE_CLEANUP_QUEUE)
export class FileCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(FileCleanupProcessor.name);

  constructor(private readonly fileCleanupService: FileCleanupService) {
    super();
  }

  async process(job: Job<FileCleanupJob>): Promise<void> {
    if (job.name !== FILE_CLEANUP_UNLINK) {
      this.logger.warn(`忽略未知文件清理任务 name=${job.name} id=${job.id}`);
      return;
    }
    await this.fileCleanupService.process(job.data);
  }
}
