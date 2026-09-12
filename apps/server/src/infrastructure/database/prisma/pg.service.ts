import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaClient } from '#/generated/prisma/client.js';
import { formatConnectFailure } from '../connect-error.js';
import { adapter } from './pg.lib.js';

/** 断线后后台重连间隔（毫秒） */
export const PG_RECONNECT_INTERVAL_MS = 5_000;

//  关于 中间件已废弃  封装使用prisma的extend的曲线方法 https://github.com/prisma/prisma/issues/18628
@Injectable()
export class PgService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PgService.name);
  private ready = false;
  private reconnectTimer?: ReturnType<typeof setInterval>;
  private reconnecting = false;
  private lastError: unknown;

  constructor() {
    super({
      adapter,
      omit: {
        user: {
          password: true,
        },
      },
    });
  }

  /** 连接并执行 SELECT 1，可覆盖 “accepted but starting up” 的空窗期 */
  private async tryConnect(): Promise<boolean> {
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
      this.ready = true;
      return true;
    } catch (error) {
      this.lastError = error;
      this.ready = false;
      return false;
    }
  }

  private pgTarget() {
    try {
      const url = process.env.PG_DATABASE_URL;
      if (!url) return 'PostgreSQL';
      const parsed = new URL(url);
      return `${parsed.hostname}:${parsed.port || '5432'}`;
    } catch {
      return 'PostgreSQL';
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setInterval(() => {
      void this.runReconnectTick();
    }, PG_RECONNECT_INTERVAL_MS);
  }

  private async runReconnectTick() {
    if (this.reconnecting || this.ready) return;
    this.reconnecting = true;
    try {
      const ok = await this.tryConnect();
      if (ok) {
        this.logger.log('PostgreSQL 连接已恢复');
        this.clearReconnectTimer();
      }
    } finally {
      this.reconnecting = false;
    }
  }

  isReady() {
    return this.ready;
  }

  /** 请求侧发现瞬时故障时调用，触发后台重连 */
  markUnavailable() {
    this.ready = false;
    this.scheduleReconnect();
  }

  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.ready = true;
      return true;
    } catch {
      this.ready = false;
      this.scheduleReconnect();
      return false;
    }
  }

  async onModuleInit() {
    const ok = await this.tryConnect();
    if (ok) {
      this.logger.log('PostgreSQL 连接成功');
      return;
    }

    this.logger.error(
      `${formatConnectFailure('PostgreSQL', this.pgTarget(), this.lastError)}。服务继续运行，将每 ${PG_RECONNECT_INTERVAL_MS / 1000}s 自动重试。`,
    );

    this.scheduleReconnect();
  }

  async onModuleDestroy() {
    this.clearReconnectTimer();
    await this.$disconnect();
  }
}
