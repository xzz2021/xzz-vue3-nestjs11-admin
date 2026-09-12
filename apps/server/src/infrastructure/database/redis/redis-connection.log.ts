import { Logger } from "@nestjs/common";
import { Redis, type RedisOptions } from "ioredis";
import { formatConnectFailure } from "../connect-error.js";
import { REDIS_RECONNECT_INTERVAL_MS } from "./redis-options.js";

const ERROR_LOG_INTERVAL_MS = 30_000;
const boundClients = new WeakSet<Redis>();

let lastFailLogAt = 0;
let outageAnnounced = false;

type RedisLogOptions = {
  logger: Logger;
  target: string;
};

/** 全进程共用：多条 Redis 连接同时失败时只打一条可读日志 */
export function logRedisConnectFailure(
  logger: Logger,
  target: string,
  error: unknown,
): void {
  const now = Date.now();
  if (now - lastFailLogAt < ERROR_LOG_INTERVAL_MS) return;
  lastFailLogAt = now;
  const base = formatConnectFailure("Redis", target, error);
  const retrySec = REDIS_RECONNECT_INTERVAL_MS / 1000;
  if (!outageAnnounced) {
    outageAnnounced = true;
    logger.error(
      `${base}。服务继续运行，${retrySec}s 后自动重试，未恢复前依赖 Redis 的接口会失败。`,
    );
    return;
  }
  logger.warn(`${base}，${retrySec}s 后自动重试`);
}

function logRedisRestored(logger: Logger, target: string): void {
  if (!outageAnnounced) return;
  outageAnnounced = false;
  lastFailLogAt = 0;
  logger.log(`Redis 连接已恢复 (${target})`);
}

/** 挂上 error 监听，避免 ioredis 打印 Unhandled error；失败日志限频 */
export function bindRedisLifecycleLogs(
  redis: Redis,
  opts: RedisLogOptions,
): void {
  if (boundClients.has(redis)) return;
  boundClients.add(redis);

  const { logger, target } = opts;

  redis.on("error", (error) => {
    logRedisConnectFailure(logger, target, error);
  });

  redis.on("ready", () => {
    logRedisRestored(logger, target);
  });

  const originalDuplicate = redis.duplicate.bind(redis);
  redis.duplicate = ((override?: RedisOptions) => {
    const cloned = originalDuplicate(override);
    bindRedisLifecycleLogs(cloned, opts);
    return cloned;
  }) as Redis["duplicate"];
}

export function createQuietRedis(
  options: RedisOptions,
  logger: Logger,
  target: string,
): Redis {
  const client = new Redis(options);
  bindRedisLifecycleLogs(client, { logger, target });
  return client;
}

export function redisTarget(host?: string, port?: number): string {
  const resolvedHost = !host || host === "localhost" ? "127.0.0.1" : host;
  return `${resolvedHost}:${port || 6379}`;
}

export function redisTargetFromEnv(): string {
  const port = Number(process.env.REDIS_PORT);
  return redisTarget(
    process.env.REDIS_HOST,
    Number.isFinite(port) && port > 0 ? port : 6379,
  );
}
