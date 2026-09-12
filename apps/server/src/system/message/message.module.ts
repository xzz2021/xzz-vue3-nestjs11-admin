import {
  buildRedisOptions,
  type AppRedisConfig,
} from '@/infrastructure/database/redis/redis-options.js';
import { SessionModule } from '@/system/session/session.module.js';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
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
        return {
          connection: buildRedisOptions(redis, {
            // BullMQ 要求
            maxRetriesPerRequest: null,
          }) as ConnectionOptions,
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
  ],
  exports: [MessageDeliveryService],
})
export class MessageModule {}
