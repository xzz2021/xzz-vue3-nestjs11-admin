import {
  createQuietRedis,
  redisTarget,
} from '#/infrastructure/database/redis/redis-connection.log.js';
import {
  buildRedisOptions,
  type AppRedisConfig,
} from '#/infrastructure/database/redis/redis-options.js';
import { BullModule } from '@nestjs/bullmq';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Global()
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
              // BullMQ 要求；离线不排队，避免启动时 await 队列操作挂死
              maxRetriesPerRequest: null,
              enableOfflineQueue: false,
            }),
            logger,
            redisTarget(redis?.host, redis?.port),
          ),
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueInfrastructureModule {}
