import { bullQueueErrorProvider } from '#/infrastructure/database/redis/bull-error.provider.js';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiskCleanupEventBus } from './disk-cleanup.events.js';
import { FILE_CLEANUP_QUEUE } from './file-cleanup.constants.js';
import { FileCleanupProcessor } from './file-cleanup.processor.js';
import { FileCleanupService } from './file-cleanup.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: FILE_CLEANUP_QUEUE })],
  providers: [
    DiskCleanupEventBus,
    FileCleanupService,
    FileCleanupProcessor,
    bullQueueErrorProvider(FILE_CLEANUP_QUEUE),
  ],
  exports: [FileCleanupService, DiskCleanupEventBus],
})
export class FileCleanupModule {}
