export interface WindowCount {
  count: number;
  ttlMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterMs: number;
}

export interface TokenBucketResult {
  allowed: boolean;
  tokens: number;
}

export interface LockHandle {
  key: string;
  token: string;
  ttlMs: number;
}

export class RedisLockNotAcquiredError extends Error {
  constructor(key: string) {
    super(`Redis lock not acquired: ${key}`);
    this.name = "RedisLockNotAcquiredError";
  }
}
