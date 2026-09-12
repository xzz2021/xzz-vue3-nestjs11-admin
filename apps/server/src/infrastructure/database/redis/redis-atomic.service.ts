import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import {
  COMPARE_AND_DELETE_SCRIPT,
  COMPARE_AND_PEXPIRE_SCRIPT,
  FIXED_WINDOW_ALLOW_SCRIPT,
  INCR_IN_WINDOW_SCRIPT,
  INCR_WITH_TTL_SCRIPT,
  SLIDING_WINDOW_COUNTER_SCRIPT,
  SLIDING_WINDOW_LOG_SCRIPT,
  TOKEN_BUCKET_ALLOW_SCRIPT,
} from './redis-atomic.scripts.js';
import {
  RedisLockNotAcquiredError,
  type LockHandle,
  type RateLimitResult,
  type TokenBucketResult,
  type WindowCount,
} from './redis-atomic.types.js';

export { RedisLockNotAcquiredError } from './redis-atomic.types.js';
export type {
  LockHandle,
  RateLimitResult,
  TokenBucketResult,
  WindowCount,
} from './redis-atomic.types.js';

@Injectable()
export class RedisAtomicService {
  private readonly redis: Redis;

  constructor(redisService: RedisService) {
    this.redis = redisService.getOrThrow();
  }

  async getCounter(key: string): Promise<number> {
    const raw = await this.redis.get(key);
    return this.toFiniteNumber(raw ?? 0, 0);
  }

  /** 版本号 / epoch：每次 INCR 并刷新 TTL。 */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    this.assertPositive('ttlSeconds', ttlSeconds);
    const value = await this.redis.eval(
      INCR_WITH_TTL_SCRIPT,
      1,
      key,
      String(Math.floor(ttlSeconds)),
    );
    return this.requireNumber(value);
  }

  /** 固定窗口计数：仅窗口内第一次写入设置过期。 */
  async incrInWindow(key: string, windowMs: number): Promise<WindowCount> {
    this.assertPositive('windowMs', windowMs);
    const [count, ttlMs] = await this.evalNumbers(
      INCR_IN_WINDOW_SCRIPT,
      1,
      [key],
      [Math.floor(windowMs)],
      2,
    );
    return { count, ttlMs: Math.max(ttlMs, 0) };
  }

  /** 固定窗口限流：INCRBY + 首次 PEXPIRE。返回 allowed, count, remaining, retryAfterMs。 */
  async fixedWindowAllow(
    key: string,
    limit: number,
    windowMs: number,
    cost = 1,
  ): Promise<RateLimitResult> {
    this.assertPositive('limit', limit);
    this.assertPositive('windowMs', windowMs);
    this.assertPositive('cost', cost);
    const [allowed, count, remaining, retryAfterMs] = await this.evalNumbers(
      FIXED_WINDOW_ALLOW_SCRIPT,
      1,
      [key],
      [Math.floor(windowMs), Math.floor(limit), Math.floor(cost)],
      4,
    );
    return this.toRateLimit(allowed, count, remaining, retryAfterMs);
  }

  /** 滑动窗口日志：ZSET 存时间戳，精确但内存随请求量增长。 */
  async slidingWindowAllow(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    this.assertPositive('limit', limit);
    this.assertPositive('windowMs', windowMs);
    const now = Date.now();
    const [allowed, count, remaining, retryAfterMs] = await this.evalNumbers(
      SLIDING_WINDOW_LOG_SCRIPT,
      1,
      [key],
      [now, Math.floor(windowMs), Math.floor(limit), `${now}-${randomUUID()}`],
      4,
    );
    return this.toRateLimit(allowed, count, remaining, retryAfterMs);
  }

  /** 滑动窗口计数：ZSET 存时间戳，精确但内存随请求量增长。 */
  async slidingWindowCounterAllow(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    this.assertPositive('limit', limit);
    this.assertPositive('windowMs', windowMs);
    const window = Math.floor(windowMs);
    const now = Date.now();
    const currentWindow = Math.floor(now / window);
    const elapsed = now - currentWindow * window;
    const [allowed, count, remaining, retryAfterMs] = await this.evalNumbers(
      SLIDING_WINDOW_COUNTER_SCRIPT,
      2,
      [`${key}:${currentWindow}`, `${key}:${currentWindow - 1}`],
      [Math.floor(limit), window, elapsed],
      4,
    );
    return this.toRateLimit(allowed, count, remaining, retryAfterMs);
  }

  /** 令牌桶限流：令牌数随时间增长，每次请求消耗令牌。返回 allowed, tokens。 */
  async tokenBucketAllow(
    key: string,
    capacity: number,
    refillPerSecond: number,
    cost = 1,
  ): Promise<TokenBucketResult> {
    this.assertPositive('capacity', capacity);
    this.assertPositive('refillPerSecond', refillPerSecond);
    this.assertPositive('cost', cost);
    const [allowed, tokens] = await this.evalNumbers(
      TOKEN_BUCKET_ALLOW_SCRIPT,
      1,
      [key],
      [capacity, refillPerSecond / 1000, Date.now(), cost],
      2,
    );
    return { allowed: allowed === 1, tokens };
  }

  async tryLock(
    key: string,
    ttlMs: number,
    token?: string,
  ): Promise<LockHandle | null> {
    this.assertPositive('ttlMs', ttlMs);
    const lockToken = token ?? randomUUID();
    const ok = await this.redis.set(
      key,
      lockToken,
      'PX',
      Math.floor(ttlMs),
      'NX',
    );
    return ok === 'OK'
      ? { key, token: lockToken, ttlMs: Math.floor(ttlMs) }
      : null;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const deleted = await this.redis.eval(
      COMPARE_AND_DELETE_SCRIPT,
      1,
      key,
      token,
    );
    return this.requireNumber(deleted) === 1;
  }

  async extendLock(
    key: string,
    token: string,
    ttlMs: number,
  ): Promise<boolean> {
    this.assertPositive('ttlMs', ttlMs);
    const extended = await this.redis.eval(
      COMPARE_AND_PEXPIRE_SCRIPT,
      1,
      key,
      token,
      String(Math.floor(ttlMs)),
    );
    return this.requireNumber(extended) === 1;
  }

  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const handle = await this.tryLock(key, ttlMs);
    if (!handle) throw new RedisLockNotAcquiredError(key);
    try {
      return await fn();
    } finally {
      await this.releaseLock(handle.key, handle.token);
    }
  }

  async compareAndDelete(key: string, expected: string): Promise<boolean> {
    return this.releaseLock(key, expected);
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<boolean> {
    const handle = await this.tryLock(key, ttlMs, value);
    return handle !== null;
  }

  /** 执行 Redis 脚本并返回数字数组。 */
  private async evalNumbers(
    script: string,
    numKeys: number,
    keys: string[],
    args: Array<string | number>,
    length: number,
  ): Promise<number[]> {
    const result = await this.redis.eval(
      script,
      numKeys,
      ...keys,
      ...args.map(String),
    );
    if (!Array.isArray(result) || result.length < length) {
      throw new Error('Unexpected Redis script result');
    }
    return result.slice(0, length).map((item) => this.requireNumber(item));
  }

  /** 将 Redis 脚本结果转换为数字。 */
  private requireNumber(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
      throw new Error('Unexpected Redis script result');
    return parsed;
  }

  private toRateLimit(
    allowed: number,
    count: number,
    remaining: number,
    retryAfterMs: number,
  ): RateLimitResult {
    return {
      allowed: allowed === 1,
      count,
      remaining: Math.max(remaining, 0),
      retryAfterMs: Math.max(retryAfterMs, 0),
    };
  }

  private toFiniteNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private assertPositive(name: string, value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive number`);
    }
  }
}
