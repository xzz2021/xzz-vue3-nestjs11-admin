import { RedisKeys } from '#/processor/constants/cache.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

export const LOGIN_LOCKOUT = {
  windowSec: 15 * 60,
  failThreshold: 8,
  baseLockSec: 5 * 60,
  maxLockSec: 12 * 60 * 60,
} as const;

@Injectable()
export class LockoutService {
  private readonly redis: Redis;

  constructor(redisService: RedisService) {
    this.redis = redisService.getOrThrow();
  }

  async ensureNotLocked(phone: string) {
    const until = await this.redis.get(this.lockKey(phone));
    if (!until) return;

    const remainingMs = Number(until) - Date.now();
    if (remainingMs <= 0) {
      await this.redis.del(this.lockKey(phone));
      return;
    }

    throw new ForbiddenException(
      `账号已锁定，请${Math.ceil(remainingMs / 1000)}秒后再试`,
    );
  }

  async onFail(phone: string) {
    const failKey = this.failKey(phone);
    const count = await this.redis.incr(failKey);
    const ttl = await this.redis.ttl(failKey);
    if (ttl < 0) {
      await this.redis.expire(failKey, LOGIN_LOCKOUT.windowSec);
    }

    if (count < LOGIN_LOCKOUT.failThreshold) return;

    const level = Number((await this.redis.get(this.levelKey(phone))) ?? 0);
    const lockSec = Math.min(
      LOGIN_LOCKOUT.baseLockSec * 2 ** level,
      LOGIN_LOCKOUT.maxLockSec,
    );
    const until = Date.now() + lockSec * 1000;
    await this.redis.set(this.lockKey(phone), String(until), 'EX', lockSec);
    await this.redis.incr(this.levelKey(phone));
    await this.redis.expire(this.levelKey(phone), LOGIN_LOCKOUT.maxLockSec);
    await this.redis.del(failKey);

    throw new ForbiddenException(`账号已锁定，请${lockSec}秒后再试`);
  }

  async onSuccess(phone: string) {
    await this.redis.del(
      this.failKey(phone),
      this.lockKey(phone),
      this.levelKey(phone),
    );
  }

  private failKey(phone: string) {
    return `${RedisKeys.AUTH_FAIL_ACCT_PREFIX}${phone}`;
  }

  private lockKey(phone: string) {
    return `${RedisKeys.AUTH_LOCK_ACCT_PREFIX}${phone}`;
  }

  private levelKey(phone: string) {
    return `${RedisKeys.AUTH_LOCK_LEVEL_PREFIX}${phone}`;
  }
}
