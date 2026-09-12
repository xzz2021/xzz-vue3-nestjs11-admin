import type { RedisOptions } from "ioredis";

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
  return {
    host: redis?.host || "127.0.0.1",
    port: redis?.port || 6379,
    db: redis?.db ?? 0,
    ...(password ? { password } : {}),
    ...overrides,
  };
}
