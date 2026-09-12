import {
  logRedisConnectFailure,
  redisTargetFromEnv,
} from "#/infrastructure/database/redis/redis-connection.log.js";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MessageDeliveryService } from "./message-delivery.service.js";
import { MESSAGE_QUEUE } from "./message.constants.js";
import type { MessageDispatchJob } from "./message.types.js";

@Processor(MESSAGE_QUEUE)
export class MessageProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(private readonly delivery: MessageDeliveryService) {
    super();
  }

  @OnWorkerEvent("error")
  onWorkerError(error: Error) {
    logRedisConnectFailure(this.logger, redisTargetFromEnv(), error);
  }

  async process(job: Job<MessageDispatchJob>): Promise<{ count: number }> {
    if (!job.data.dispatchId) {
      this.logger.error(`消息任务缺少 dispatchId job=${job.id}`);
      return { count: 0 };
    }
    return this.delivery.dispatch(job.data);
  }
}
