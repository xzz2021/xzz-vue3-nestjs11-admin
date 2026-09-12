import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  logRedisConnectFailure,
  redisTarget,
} from './redis-connection.log.js';

@Injectable()
export class RedisHealthService implements OnModuleInit {
  private readonly logger = new Logger(RedisHealthService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const redisConfig = this.configService.get<{
      host?: string;
      port?: number;
    }>('redis');
    const target = redisTarget(redisConfig?.host, redisConfig?.port);
    try {
      const redis = this.redisService.getOrThrow('default');
      if (redis.status !== 'ready') {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Redis 连接超时')),
            5000,
          );
          const onReady = () => {
            clearTimeout(timer);
            redis.off('error', onError);
            resolve();
          };
          const onError = (err: Error) => {
            clearTimeout(timer);
            redis.off('ready', onReady);
            reject(err);
          };
          redis.once('ready', onReady);
          redis.once('error', onError);
        });
      }
      await redis.ping();
      this.logger.log(`Redis 连接成功 (${target})`);
    } catch (error) {
      logRedisConnectFailure(this.logger, target, error);
    }
  }

  async ping(): Promise<boolean> {
    try {
      const redis = this.redisService.getOrThrow('default');
      const result = await redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
