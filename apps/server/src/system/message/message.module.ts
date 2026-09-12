import { bullQueueErrorProvider } from '#/infrastructure/database/redis/bull-error.provider.js';
import {
  createQuietRedis,
  redisTarget,
} from '#/infrastructure/database/redis/redis-connection.log.js';
import {
  buildRedisOptions,
  type AppRedisConfig,
} from '#/infrastructure/database/redis/redis-options.js';
import { SessionModule } from '#/system/session/session.module.js';
import { BullModule } from '@nestjs/bullmq';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MessageInboxController } from './message-inbox.controller.js';
import { MessageDeliveryService } from './message-delivery.service.js';
import { MESSAGE_QUEUE } from './message.constants.js';
import { MessageGateway } from './message.gateway.js';
import { MessageProcessor } from './message.processor.js';
import { MessageRepository } from './message.repository.js';
import { MessageService } from './message.service.js';
import { NotificationController } from './notification.controller.js';

@Module({
  imports: [
    SessionModule,
    JwtModule.register({}),
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
    BullModule.registerQueue({ name: MESSAGE_QUEUE }),
  ],
  controllers: [MessageInboxController, NotificationController],
  providers: [
    MessageRepository,
    MessageDeliveryService,
    MessageService,
    MessageProcessor,
    MessageGateway,
    bullQueueErrorProvider(MESSAGE_QUEUE),
  ],
  exports: [MessageDeliveryService],
})
export class MessageModule {}
