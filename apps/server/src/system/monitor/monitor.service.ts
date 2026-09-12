import { RedisHealthService } from '@/infrastructure/database/redis/redis-health.service.js';
import { NoticeLevel } from '@/generated/prisma/enums.js';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { MessageDeliveryService } from '@/system/message/message-delivery.service.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Redis } from 'ioredis';
import * as os from 'node:os';
import si from 'systeminformation';

import { MonitorErrorBuffer } from './monitor-error.buffer.js';
import { MonitorLatencyTracker } from './monitor-latency.tracker.js';
import {
  MONITOR_CRON,
  MONITOR_ERRORS_MAX,
  MONITOR_METRICS_MAX,
  MONITOR_REDIS,
} from './monitor.constants.js';
import type {
  HealthProbe,
  MetricPoint,
  MonitorErrorItem,
  MonitorPayload,
  MonitorSnapshot,
} from './monitor.types.js';

@Injectable()
export class MonitorService implements OnModuleInit {
  private readonly logger = new Logger(MonitorService.name);
  private readonly redis: Redis;
  private readonly startedAt = Date.now();
  private collecting = false;

  constructor(
    redisService: RedisService,
    private readonly pgService: PgService,
    private readonly redisHealthService: RedisHealthService,
    private readonly latencyTracker: MonitorLatencyTracker,
    private readonly errorBuffer: MonitorErrorBuffer,
    @Optional() private readonly messageDelivery?: MessageDeliveryService,
  ) {
    this.redis = redisService.getOrThrow('default');
  }

  async onModuleInit(): Promise<void> {
    await this.hydrateErrorsFromRedis();
    // 启动时先采一次，避免前端空白
    void this.collectAndStore().catch((err) => {
      this.logger.warn(
        `初始监控采集失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  @Cron(MONITOR_CRON)
  async handleCron(): Promise<void> {
    await this.collectAndStore();
  }

  async getPayload(): Promise<MonitorPayload> {
    const [snapshot, metrics, errors] = await Promise.all([
      this.getLatestSnapshot(),
      this.getMetrics(),
      this.getErrors(),
    ]);
    return {
      snapshot: snapshot ?? (await this.buildSnapshot()),
      metrics,
      errors,
    };
  }

  async recordError(
    item: Omit<MonitorErrorItem, 't'> & { t?: number },
  ): Promise<void> {
    const entry = this.errorBuffer.push(item);
    try {
      await this.redis.lpush(MONITOR_REDIS.ERRORS, JSON.stringify(entry));
      await this.redis.ltrim(MONITOR_REDIS.ERRORS, 0, MONITOR_ERRORS_MAX - 1);
    } catch (error) {
      this.logger.debug(
        `写入监控错误日志失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async collectAndStore(): Promise<void> {
    if (this.collecting) return;
    this.collecting = true;
    try {
      const snapshot = await this.buildSnapshot();
      const point: MetricPoint = {
        t: snapshot.timestamp,
        cpu: snapshot.cpu.usage,
        mem: snapshot.memory.usage,
        memUsed: snapshot.memory.used,
        memTotal: snapshot.memory.total,
        latency: snapshot.api.avgLatencyMs,
        load: snapshot.cpu.load1,
      };

      const pipeline = this.redis.pipeline();
      pipeline.set(MONITOR_REDIS.LATEST, JSON.stringify(snapshot), 'EX', 3600);
      pipeline.lpush(MONITOR_REDIS.METRICS, JSON.stringify(point));
      pipeline.ltrim(MONITOR_REDIS.METRICS, 0, MONITOR_METRICS_MAX - 1);
      // 滑动列表本身有上限，额外设 TTL 防止长期无人访问残留
      pipeline.expire(MONITOR_REDIS.METRICS, 7200);
      await pipeline.exec();
      void this.maybeAlertDown(snapshot);
    } catch (error) {
      this.logger.warn(
        `监控数据采集失败: ${error instanceof Error ? errMsg(error) : String(error)}`,
      );
    } finally {
      this.collecting = false;
    }
  }

  /** PG/Redis 宕机时防抖告警给超管（10 分钟内同 key 只发一次） */
  private async maybeAlertDown(snapshot: MonitorSnapshot): Promise<void> {
    if (!this.messageDelivery) return;
    const downs: Array<{ key: string; title: string; content: string }> = [];
    if (snapshot.postgres.status === 'down') {
      downs.push({
        key: 'postgres',
        title: 'PostgreSQL 异常',
        content: snapshot.postgres.message || '数据库健康检查失败',
      });
    }
    if (snapshot.redis.status === 'down') {
      downs.push({
        key: 'redis',
        title: 'Redis 异常',
        content: snapshot.redis.message || 'Redis 健康检查失败',
      });
    }
    for (const item of downs) {
      try {
        await this.messageDelivery.enqueueAlertDebounced(
          item.key,
          {
            title: item.title,
            content: item.content,
            level: NoticeLevel.ERROR,
            meta: { source: 'monitor', probe: item.key },
          },
          600,
        );
      } catch (error) {
        this.logger.debug(
          `监控告警发送失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async buildSnapshot(): Promise<MonitorSnapshot> {
    const [cpuLoad, mem, osInfo, cpuInfo, disk, postgres, redisProbe] =
      await Promise.all([
        si.currentLoad().catch(() => null),
        si.mem().catch(() => null),
        si.osInfo().catch(() => null),
        si.cpu().catch(() => null),
        this.collectDisk(),
        this.probePostgres(),
        this.probeRedis(),
      ]);

    const totalMem = mem?.total ?? os.totalmem();
    const freeMem = mem?.available ?? mem?.free ?? os.freemem();
    const usedMem = Math.max(totalMem - freeMem, 0);
    const loads = os.loadavg();
    const api = this.latencyTracker.getAverage();

    return {
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      app: {
        status: 'up',
        pid: process.pid,
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()),
      },
      server: {
        hostname: osInfo?.hostname || os.hostname(),
        platform: osInfo?.platform || os.platform(),
        arch: osInfo?.arch || os.arch(),
        cpuCount: os.cpus().length,
        cpuModel: cpuInfo?.brand || os.cpus()[0]?.model || 'unknown',
      },
      cpu: {
        usage: round(cpuLoad?.currentLoad ?? 0),
        load1: round(loads[0] ?? 0),
        load5: round(loads[1] ?? 0),
        load15: round(loads[2] ?? 0),
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usage: totalMem > 0 ? round((usedMem / totalMem) * 100) : 0,
      },
      disk,
      postgres,
      redis: redisProbe,
      api,
    };
  }

  private async collectDisk(): Promise<MonitorSnapshot['disk']> {
    try {
      const sizes = await si.fsSize();
      const root =
        sizes.find(
          (item) =>
            item.mount === '/' || item.mount === 'C:' || item.mount === 'C:\\',
        ) ?? sizes.sort((a, b) => b.size - a.size)[0];
      if (!root) return null;
      return {
        total: root.size,
        used: root.used,
        free: Math.max(root.size - root.used, 0),
        usage: round(root.use),
        mount: root.mount,
      };
    } catch {
      return null;
    }
  }

  private async probePostgres(): Promise<HealthProbe> {
    const start = Date.now();
    try {
      await this.pgService.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async probeRedis(): Promise<HealthProbe> {
    const start = Date.now();
    try {
      const ok = await this.redisHealthService.ping();
      return {
        status: ok ? 'up' : 'down',
        latencyMs: Date.now() - start,
        message: ok ? undefined : 'PING failed',
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async getLatestSnapshot(): Promise<MonitorSnapshot | null> {
    try {
      const raw = await this.redis.get(MONITOR_REDIS.LATEST);
      if (!raw) return null;
      return JSON.parse(raw) as MonitorSnapshot;
    } catch {
      return null;
    }
  }

  private async getMetrics(): Promise<MetricPoint[]> {
    try {
      const list = await this.redis.lrange(
        MONITOR_REDIS.METRICS,
        0,
        MONITOR_METRICS_MAX - 1,
      );
      // Redis 存的是新→旧，图表需要旧→新
      return list
        .map((item) => {
          try {
            return JSON.parse(item) as MetricPoint;
          } catch {
            return null;
          }
        })
        .filter((item): item is MetricPoint => item != null)
        .reverse();
    } catch {
      return [];
    }
  }

  private async getErrors(): Promise<MonitorErrorItem[]> {
    const memory = this.errorBuffer.list();
    if (memory.length > 0) return memory;
    return this.readErrorsFromRedis();
  }

  private async readErrorsFromRedis(): Promise<MonitorErrorItem[]> {
    try {
      const list = await this.redis.lrange(
        MONITOR_REDIS.ERRORS,
        0,
        MONITOR_ERRORS_MAX - 1,
      );
      return list
        .map((item) => {
          try {
            return JSON.parse(item) as MonitorErrorItem;
          } catch {
            return null;
          }
        })
        .filter((item): item is MonitorErrorItem => item != null);
    } catch {
      return [];
    }
  }

  private async hydrateErrorsFromRedis(): Promise<void> {
    const items = await this.readErrorsFromRedis();
    if (items.length > 0) {
      this.errorBuffer.replace(items);
    }
  }
}

function round(value: number, digits = 1): number {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function errMsg(error: Error): string {
  return error.message;
}
