import type { RedisOptions } from "ioredis";

/** 断线后重连间隔（毫秒） */
export const REDIS_RECONNECT_INTERVAL_MS = 15_000;

export type AppRedisConfig = {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  url?: string;
};

/**
 * 统一 Redis 连接参数：无密码时不传 password，避免 ioredis AUTH 触发
 * “default user does not require a password, but a password was supplied”
 */
export function buildRedisOptions(
  redis: AppRedisConfig | undefined | null,
  overrides: RedisOptions = {},
): RedisOptions {
  const password = redis?.password?.trim();
  const host =
    !redis?.host || redis.host === "localhost" ? "127.0.0.1" : redis.host;
  return {
    host,
    port: redis?.port || 6379,
    db: redis?.db ?? 0,
    retryStrategy: () => REDIS_RECONNECT_INTERVAL_MS,
    ...(host === "127.0.0.1" ? { family: 4 as const } : {}),
    ...(password ? { password } : {}),
    ...overrides,
  };
}
