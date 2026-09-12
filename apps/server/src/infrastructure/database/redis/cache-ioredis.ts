import { RedisModule, type RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { bindRedisLifecycleLogs, redisTarget } from './redis-connection.log.js';
import {
  buildRedisOptions,
  REDIS_RECONNECT_INTERVAL_MS,
  type AppRedisConfig,
} from './redis-options.js';

export { REDIS_RECONNECT_INTERVAL_MS };

const redisLogger = new Logger('Redis');

// 使用模块方式  可以设置多个实例
export const REDIS_MODULE = RedisModule.forRootAsync({
  // isGlobal: true,
  inject: [ConfigService],
  useFactory: (...args: unknown[]): RedisModuleOptions => {
    const configService = args[0] as ConfigService;
    const redis = configService.get<AppRedisConfig>('redis');
    const target = redisTarget(redis?.host, redis?.port);
    return {
      readyLog: false,
      errorLog: false,
      // 可声明多个命名实例
      config: [
        {
          namespace: 'default',
          ...buildRedisOptions(redis, {
            lazyConnect: false, // 启动时立即连接，便于尽早发现 Redis 不可用
            enableAutoPipelining: true,
            enableOfflineQueue: false, // 断线时不排队等待，命令立即失败
            connectTimeout: 5000, // 连接超时 5s
            maxRetriesPerRequest: 1, // 命令最多重试 1 次，避免请求长时间挂起
            retryStrategy: () => REDIS_RECONNECT_INTERVAL_MS, // 断线后自动重连，不限制次数
            reconnectOnError: (err) =>
              /READONLY/.test(err.message) ? 1 : false,
          }),
          onClientCreated(client: Redis) {
            bindRedisLifecycleLogs(client, { logger: redisLogger, target });
          },
        },
      ],
    };
  },
});
