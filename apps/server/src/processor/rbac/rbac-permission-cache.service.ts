import { AuthorizationCacheUnavailableException } from '#/processor/authorization/authorization.errors.js';
import { RedisKeys } from '#/processor/constants/cache.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

interface PermissionCachePayload {
  v: number;
  p: string[];
}

const INVALIDATE_USER_SCRIPT = `
local generation = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
return generation
`;

@Injectable()
export class RbacPermissionCacheService {
  static readonly TTL_SECONDS = 5 * 60;
  static readonly TTL_JITTER_SECONDS = 60;
  static readonly GEN_TTL_SECONDS =
    RbacPermissionCacheService.TTL_SECONDS +
    RbacPermissionCacheService.TTL_JITTER_SECONDS +
    60;
  static readonly LOCK_TTL_SECONDS = 10;
  static readonly LOCK_WAIT_ATTEMPTS = 5;
  static readonly LOCK_WAIT_MS = 20;
  static readonly INVALIDATE_ATTEMPTS = 3;
  static readonly INVALIDATE_RETRY_MS = 20;

  private readonly redis: Redis;
  private readonly inflight = new Map<string, Promise<string[]>>();

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  key(userId: string) {
    return `${RedisKeys.RBAC_PERMISSIONS_PREFIX}${userId}`;
  }

  genKey(userId: string) {
    return `${RedisKeys.RBAC_PERM_GEN_PREFIX}${userId}`;
  }

  lockKey(userId: string) {
    return `${RedisKeys.RBAC_PERM_LOCK_PREFIX}${userId}`;
  }

  async currentGeneration(userId: string): Promise<number> {
    const raw = await this.redis.get(this.genKey(userId));
    const generation = Number(raw ?? 0);
    return Number.isFinite(generation) ? generation : 0;
  }

  async get(userId: string): Promise<string[] | null> {
    const [cached, genRaw] = await this.redis.mget(
      this.key(userId),
      this.genKey(userId),
    );
    if (cached === null) return null;

    const payload = this.parsePayload(cached);
    if (!payload) {
      await this.redis.del(this.key(userId));
      return null;
    }

    const currentGen = Number(genRaw ?? 0);
    if (!Number.isFinite(currentGen) || payload.v !== currentGen) return null;
    return payload.p;
  }

  async set(userId: string, permissions: string[]) {
    const genRaw = await this.redis.get(this.genKey(userId));
    const gen = Number(genRaw ?? 0); // 生成版本号, 用于判断缓存是否过期
    const payload: PermissionCachePayload = {
      v: Number.isFinite(gen) ? gen : 0, // 当前版本号 isFinite 判断是否为数字
      p: permissions,
    };
    await this.redis.set(
      this.key(userId),
      JSON.stringify(payload),
      'EX',
      this.ttlSeconds(),
    );
  }

  /** 未命中时合并并发加载；空数组作为负缓存，避免对无权限用户反复打库 */
  async getOrLoad(
    userId: string,
    loader: () => Promise<string[]>,
  ): Promise<string[]> {
    const existing = this.inflight.get(userId);
    if (existing) return existing;

    const pending = this.fill(userId, loader).finally(() => {
      this.inflight.delete(userId);
    });
    this.inflight.set(userId, pending);
    return pending;
  }

  async invalidateUsers(userIds: string[]) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (!uniqueIds.length) return;

    try {
      await Promise.all(uniqueIds.map((userId) => this.invalidateUser(userId)));
    } catch (error) {
      throw new AuthorizationCacheUnavailableException(error);
    }
  }

  private async invalidateUser(userId: string) {
    let cause: unknown;
    for (
      let attempt = 0;
      attempt < RbacPermissionCacheService.INVALIDATE_ATTEMPTS;
      attempt++
    ) {
      try {
        await this.redis.eval(
          INVALIDATE_USER_SCRIPT,
          2,
          this.genKey(userId),
          this.key(userId),
          String(RbacPermissionCacheService.GEN_TTL_SECONDS),
        );
        return;
      } catch (error) {
        cause = error;
        if (attempt + 1 < RbacPermissionCacheService.INVALIDATE_ATTEMPTS) {
          await this.sleep(RbacPermissionCacheService.INVALIDATE_RETRY_MS);
        }
      }
    }
    throw cause;
  }

  private async fill(
    userId: string,
    loader: () => Promise<string[]>,
  ): Promise<string[]> {
    const cached = await this.get(userId);
    if (cached !== null) return cached;

    const locked = await this.redis.set(
      this.lockKey(userId),
      '1',
      'EX',
      RbacPermissionCacheService.LOCK_TTL_SECONDS,
      'NX',
    );
    if (locked !== 'OK') {
      const waited = await this.waitForCache(userId);
      if (waited !== null) return waited;
    }

    try {
      const permissions = await loader();
      await this.set(userId, permissions);
      return permissions;
    } finally {
      if (locked === 'OK') {
        await this.redis.del(this.lockKey(userId));
      }
    }
  }

  private async waitForCache(userId: string): Promise<string[] | null> {
    for (let i = 0; i < RbacPermissionCacheService.LOCK_WAIT_ATTEMPTS; i++) {
      await this.sleep(RbacPermissionCacheService.LOCK_WAIT_MS);
      const cached = await this.get(userId);
      if (cached !== null) return cached;
    }
    return null;
  }

  private parsePayload(cached: string): PermissionCachePayload | null {
    try {
      const parsed: unknown = JSON.parse(cached);
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'string')
      ) {
        return { v: 0, p: parsed };
      }
      if (!parsed || typeof parsed !== 'object') return null;
      const record = parsed as { v?: unknown; p?: unknown };
      if (typeof record.v !== 'number' || !Number.isFinite(record.v))
        return null;
      if (
        !Array.isArray(record.p) ||
        !record.p.every((item) => typeof item === 'string')
      ) {
        return null;
      }
      return { v: record.v, p: record.p };
    } catch {
      return null;
    }
  }

  private ttlSeconds() {
    return (
      RbacPermissionCacheService.TTL_SECONDS +
      Math.floor(
        Math.random() * (RbacPermissionCacheService.TTL_JITTER_SECONDS + 1),
      )
    );
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
