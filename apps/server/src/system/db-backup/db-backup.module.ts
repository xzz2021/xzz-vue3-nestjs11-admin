import { FileCleanupModule } from "@/system/file-cleanup/file-cleanup.module.js";
import { MessageModule } from "@/system/message/message.module.js";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { DbBackupConfigService } from "./db-backup-config.service.js";
import { DbBackupLifecycleService } from "./db-backup-lifecycle.service.js";
import { BackupDiskListener } from "./backup-disk.listener.js";
import { DB_BACKUP_QUEUE } from "./db-backup.constants.js";
import { DbBackupController } from "./db-backup.controller.js";
import { DbBackupProcessor } from "./db-backup.processor.js";
import { DbBackupRepository } from "./db-backup.repository.js";
import { DbBackupService } from "./db-backup.service.js";
import { PgDumpRunner } from "./pg-dump.runner.js";

@Module({
  imports: [
    MessageModule,
    FileCleanupModule,
    BullModule.registerQueue({ name: DB_BACKUP_QUEUE }),
  ],
  controllers: [DbBackupController],
  providers: [
    DbBackupService,
    DbBackupRepository,
    DbBackupProcessor,
    PgDumpRunner,
    DbBackupConfigService,
    DbBackupLifecycleService,
    BackupDiskListener,
  ],
  exports: [DbBackupService],
})
export class DbBackupModule {}
