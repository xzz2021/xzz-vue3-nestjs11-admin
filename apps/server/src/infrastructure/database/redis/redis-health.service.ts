import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';

import { REDIS_RECONNECT_INTERVAL_MS } from './cache-ioredis.js';

@Injectable()
export class RedisHealthService implements OnModuleInit {
  private readonly logger = new Logger(RedisHealthService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private bindReconnectEvents(redis: Redis, target: string) {
    let wasDisconnected = false;

    redis.on('close', () => {
      wasDisconnected = true;
      this.logger.warn(
        `Redis 连接已断开 (${target})，${REDIS_RECONNECT_INTERVAL_MS / 1000}s 后自动重连...`,
      );
    });
    redis.on('reconnecting', () => {
      this.logger.log(`Redis 正在重连 (${target})...`);
    });
    redis.on('ready', () => {
      if (wasDisconnected) {
        wasDisconnected = false;
        this.logger.log(`Redis 连接已恢复 (${target})`);
      }
    });
  }

  async onModuleInit() {
    const redisConfig = this.configService.get<{
      host?: string;
      port?: number;
    }>('redis');
    const target = `${redisConfig?.host || 'localhost'}:${redisConfig?.port || 6379}`;
    try {
      const redis = this.redisService.getOrThrow('default');
      this.bindReconnectEvents(redis, target);
      // 连接尚未就绪时，等待 ready 事件（带超时）
      if (redis.status !== 'ready') {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('Redis 连接超时')),
            5000,
          );
          redis.once('ready', () => {
            clearTimeout(timer);
            resolve();
          });
          redis.once('error', (err) => {
            clearTimeout(timer);
            reject(err);
          });
        });
      }
      await redis.ping();
      this.logger.log(`Redis 连接成功 (${target})`);
      console.log('Redis 连接成功');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Redis 连接失败 (${target})，请确认 Redis 已启动。错误: ${message}`,
      );

      if (process.env.NODE_ENV !== 'production') {
        this.logger.error(
          '开发环境下 Redis 为必需依赖，服务将继续运行，但接口请求可能失败。',
        );
      }
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
