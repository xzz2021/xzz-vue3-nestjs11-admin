//  全局动态限流

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import { SKIP_THROTTLE_KEY } from '@/processor/decorator/throttle.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import {Redis} from 'ioredis';

@Injectable()
export class DynamicThrottlerGuard implements CanActivate {
  private readonly redis: Redis;
  constructor(
    private readonly redisService: RedisService,
    private reflector: Reflector,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  private buildKey(req: any) {
    // 优先使用客户端传来的 Idempotency-Key；否则回退到 用户/来源+路由+请求体哈希
    const idem = req.headers['Idempotency-Key'] as string;
    if (idem) return `idem:${idem}`;

    const user = req?.user?.id ?? req?.ip ?? 'anonymous';
    const path = `${req?.method}:${req?.baseUrl || ''}${req?.path}`;
    const bodySig = crypto
      .createHash('sha1')
      .update(JSON.stringify(req?.body ?? {}))
      .digest('hex');
    return `idem:${user}:${path}:${bodySig}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return true;

    const request: any = context.switchToHttp().getRequest();
    //  根据用户身份 请求路径 请求方式 参数 生成一个唯一的key
    const key = this.buildKey(request);
    const isLimit = (await this.redis.get(key)) || 0;

    if (isLimit) {
      throw new HttpException(
        '请求过于频繁, 请稍后再试!',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const limitTime = 2000;
    // 通过时长缓存 限制 同一类型请求 limitTime内只能请求一次
    // 主要是为了规避 错误代码 重复请求
    await this.redis.set(key, '1', 'PX', limitTime);

    return true;
  }
}

@Injectable()
//  带 幂等锁 token 的版本  适用于支付类接口
export class DynamicThrottlerGuard2 implements CanActivate {
  private readonly redis: Redis;
  constructor(
    private readonly redisService: RedisService,
    private reflector: Reflector,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  private buildKey(req: Request) {
    // 注意：Express 会把 header key 转小写
    const idem =
      (req.headers['idempotency-key'] as string) ||
      (req.headers['Idempotency-Key'] as any);
    if (idem) return `idem:${idem}`;

    const user = (req as any)?.user?.id ?? (req as any)?.ip ?? 'anonymous';
    const path = `${req.method}:${(req as any).baseUrl || ''}${(req as any).path}`;
    const bodySig = crypto
      .createHash('sha1')
      .update(JSON.stringify((req as any).body ?? {}))
      .digest('hex');
    return `idem:${user}:${path}:${bodySig}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = this.buildKey(req);
    const ttlMs = 10_000; // 1s 窗口

    // 优先：直接用底层 Redis 实现“真正的分布式锁”
    const token = crypto.randomBytes(16).toString('hex');

    // 1) 抢锁：SET key token PX ttl NX
    const ok = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (ok !== 'OK') {
      throw new HttpException(
        '请求过于频繁, 请稍后再试!',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2) 响应结束时原子释放：compare-and-del（防止误删他人新锁）
    const lua = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
    const release = async () => {
      try {
        await this.redis.eval(lua, 1, key, token);
      } catch (error) {
        // 忽略释放锁时的错误，避免影响主流程
        console.warn('释放分布式锁时出错:', error);
      }
    };
    (res as any).once('finish', release);
    (res as any).once('close', release);
    (res as any).once('error', release);

    // 可选：把锁信息挂到 req 上，便于后续层使用
    (req as any).idempotency = { key, token, ttlMs };

    /*
        // 退路：没有 Redis（比如降级到内存 Keyv）→ 用 get/set 模拟（不具备强原子性）
    const isLimit = (await this.redis.get(key)) == '1' || 0;
    if (isLimit) {
      throw new HttpException('请求过于频繁, 请稍后再试!', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.redis.set(key, '1', 'PX', ttlMs);
    // 如需主动释放（非 Redis 情况下），可以在 res.finish 时 this.redis.del(key)；
    // 但没有 token 保护，存在误删风险，这也是为什么优先走 Redis 客户端的原因。
    */

    return true;
  }
}
