import type { RedisService } from "@liaoliaots/nestjs-redis";
import { ForbiddenException } from "@nestjs/common";
import { RedisKeys } from "#/processor/constants/cache.js";
import { LOGIN_LOCKOUT, LockoutService } from "./lockout.service.js";

class MemoryRedis {
  private readonly store = new Map<string, string>();
  readonly expireCalls: Array<[string, number]> = [];
  readonly setExCalls: Array<[string, string, number]> = [];

  get(key: string) {
    return Promise.resolve(this.store.get(key) ?? null);
  }

  incr(key: string) {
    const next = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(next));
    return Promise.resolve(next);
  }

  set(key: string, value: string, mode?: string, seconds?: number) {
    this.store.set(key, value);
    if (mode === "EX" && typeof seconds === "number") {
      this.setExCalls.push([key, value, seconds]);
    }
    return Promise.resolve("OK");
  }

  expire(key: string, seconds: number) {
    this.expireCalls.push([key, seconds]);
    return Promise.resolve(this.store.has(key) ? 1 : 0);
  }

  ttl(key: string) {
    return Promise.resolve(this.store.has(key) ? -1 : -2);
  }

  del(...keys: string[]) {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) removed += 1;
    }
    return Promise.resolve(removed);
  }
}

describe("LockoutService", () => {
  const phone = "13800138000";
  let redis: MemoryRedis;
  let service: LockoutService;

  const failKey = `${RedisKeys.AUTH_FAIL_ACCT_PREFIX}${phone}`;
  const lockKey = `${RedisKeys.AUTH_LOCK_ACCT_PREFIX}${phone}`;
  const levelKey = `${RedisKeys.AUTH_LOCK_LEVEL_PREFIX}${phone}`;

  beforeEach(() => {
    redis = new MemoryRedis();
    service = new LockoutService({
      getOrThrow: () => redis,
    } as unknown as RedisService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows login when the account is not locked", async () => {
    await expect(service.ensureNotLocked(phone)).resolves.toBeUndefined();
  });

  it("rejects login while the account lock is active", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    await redis.set(lockKey, String(now + 12_000), "EX", 12);

    await expect(service.ensureNotLocked(phone)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.ensureNotLocked(phone)).rejects.toThrow(
      "账号已锁定，请12秒后再试",
    );
  });

  it("does not lock before the failure threshold", async () => {
    for (let i = 0; i < LOGIN_LOCKOUT.failThreshold - 1; i++) {
      await service.onFail(phone);
    }

    await expect(service.ensureNotLocked(phone)).resolves.toBeUndefined();
    expect(await redis.get(failKey)).toBe(
      String(LOGIN_LOCKOUT.failThreshold - 1),
    );
    expect(redis.expireCalls[0]).toEqual([failKey, LOGIN_LOCKOUT.windowSec]);
  });

  it("locks the phone after consecutive failures and starts a fresh window", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < LOGIN_LOCKOUT.failThreshold - 1; i++) {
      await service.onFail(phone);
    }

    await expect(service.onFail(phone)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await redis.get(failKey)).toBeNull();
    expect(await redis.get(lockKey)).toBe(
      String(now + LOGIN_LOCKOUT.baseLockSec * 1000),
    );
    expect(redis.setExCalls.at(-1)).toEqual([
      lockKey,
      String(now + LOGIN_LOCKOUT.baseLockSec * 1000),
      LOGIN_LOCKOUT.baseLockSec,
    ]);
  });

  it("doubles lock duration on the next threshold hit", async () => {
    for (let i = 0; i < LOGIN_LOCKOUT.failThreshold; i++) {
      await service.onFail(phone).catch(() => undefined);
    }
    await redis.del(lockKey);

    for (let i = 0; i < LOGIN_LOCKOUT.failThreshold - 1; i++) {
      await service.onFail(phone);
    }

    await expect(service.onFail(phone)).rejects.toThrow(/账号已锁定/);
    expect(redis.setExCalls.at(-1)?.[2]).toBe(LOGIN_LOCKOUT.baseLockSec * 2);
  });

  it("caps lock duration at the configured maximum", async () => {
    await redis.set(levelKey, "20");

    for (let i = 0; i < LOGIN_LOCKOUT.failThreshold - 1; i++) {
      await service.onFail(phone);
    }

    await expect(service.onFail(phone)).rejects.toThrow(/账号已锁定/);
    expect(redis.setExCalls.at(-1)?.[2]).toBe(LOGIN_LOCKOUT.maxLockSec);
  });

  it("clears failure and lock state after a successful login", async () => {
    await redis.set(failKey, "7");
    await redis.set(lockKey, "1");
    await redis.set(levelKey, "3");

    await service.onSuccess(phone);

    expect(await redis.get(failKey)).toBeNull();
    expect(await redis.get(lockKey)).toBeNull();
    expect(await redis.get(levelKey)).toBeNull();
  });
});
