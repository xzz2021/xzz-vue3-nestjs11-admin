import { bullQueueErrorProvider } from '#/infrastructure/database/redis/bull-error.provider.js';
import {
  createQuietRedis,
  redisTarget,
} from '#/infrastructure/database/redis/redis-connection.log.js';
import {
  buildRedisOptions,
  type AppRedisConfig,
} from '#/infrastructure/database/redis/redis-options.js';
import { BullModule } from '@nestjs/bullmq';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
        const logger = new Logger('BullMQ');
        return {
          connection: createQuietRedis(
            buildRedisOptions(redis, {
              maxRetriesPerRequest: null,
              enableOfflineQueue: false,
            }),
            logger,
            redisTarget(redis?.host, redis?.port),
          ),
        };
      },
    }),
    BullModule.registerQueue({ name: FILE_CLEANUP_QUEUE }),
  ],
  providers: [
    DiskCleanupEventBus,
    FileCleanupService,
    FileCleanupProcessor,
    bullQueueErrorProvider(FILE_CLEANUP_QUEUE),
  ],
  exports: [FileCleanupService, DiskCleanupEventBus],
})
export class FileCleanupModule {}
