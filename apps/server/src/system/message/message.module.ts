import { bullQueueErrorProvider } from '#/infrastructure/database/redis/bull-error.provider.js';
import { SessionModule } from '#/system/session/session.module.js';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
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
