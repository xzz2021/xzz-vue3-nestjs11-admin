import {
  buildRedisOptions,
  type AppRedisConfig,
} from '@/infrastructure/database/redis/redis-options.js';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import { DiskCleanupEventBus } from './disk-cleanup.events.js';
import { FILE_CLEANUP_QUEUE } from './file-cleanup.constants.js';
import { FileCleanupProcessor } from './file-cleanup.processor.js';
import { FileCleanupService } from './file-cleanup.service.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.get<AppRedisConfig>('redis');
        return {
          connection: buildRedisOptions(redis, {
            maxRetriesPerRequest: null,
          }) as ConnectionOptions,
        };
      },
    }),
    BullModule.registerQueue({ name: FILE_CLEANUP_QUEUE }),
  ],
  providers: [DiskCleanupEventBus, FileCleanupService, FileCleanupProcessor],
  exports: [FileCleanupService, DiskCleanupEventBus],
})
export class FileCleanupModule {}
