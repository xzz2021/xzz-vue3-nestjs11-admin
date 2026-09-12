import { getQueueToken } from "@nestjs/bullmq";
import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import {
  logRedisConnectFailure,
  redisTarget,
} from "./redis-connection.log.js";
import type { AppRedisConfig } from "./redis-options.js";

/** 吞掉 BullMQ Queue 的 error，避免 Node 打印未处理异常堆栈 */
export function bullQueueErrorProvider(queueName: string): Provider {
  return {
    provide: `BULL_QUEUE_ERROR_LOG_${queueName}`,
    inject: [getQueueToken(queueName), ConfigService],
    useFactory: (queue: Queue, configService: ConfigService) => {
      const redis = configService.get<AppRedisConfig>("redis");
      const logger = new Logger("BullMQ");
      const target = redisTarget(redis?.host, redis?.port);
      queue.on("error", (error) => {
        logRedisConnectFailure(logger, target, error);
      });
      return true;
    },
  };
}
