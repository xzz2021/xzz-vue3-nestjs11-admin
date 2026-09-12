import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { lookupIpLocation } from '@/processor/utils/index.js';
import { RtTokenService } from '@/system/auth/rt.token.service.js';
import { TokenService } from '@/system/auth/token.service.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  ONLINE_AWAY_MS,
  ONLINE_PRESENCE_TTL_SEC,
  ONLINE_REDIS,
} from './online.constants.js';
import type {
  OnlineListResult,
  OnlineSession,
  OnlineStatus,
  OnlineUserItem,
  UpsertOnlineInput,
} from './online.types.js';
import { parseUserAgent } from './online.ua.js';

const SUPER_ADMIN_ROLE = 'super_admin';

@Injectable()
export class OnlineService {
  private readonly logger = new Logger(OnlineService.name);
  private readonly redis: Redis;

  constructor(
    redisService: RedisService,
    private readonly pgService: PgService,
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
  ) {
    this.redis = redisService.getOrThrow('default');
  }

  private sessionKey(jti: string) {
    return `${ONLINE_REDIS.SESSION}${jti}`;
  }

  async upsert(input: UpsertOnlineInput): Promise<OnlineSession> {
    const now = Date.now();
    const existing = await this.getByJti(input.jti);
    const parsed = parseUserAgent(input.userAgent);
    const session: OnlineSession = {
      jti: input.jti,
      userId: input.userId,
      username: input.username || existing?.username || '-',
      phone: input.phone ?? existing?.phone ?? '',
      ip: input.ip || existing?.ip || '-',
      location:
        input.location ||
        existing?.location ||
        (await lookupIpLocation(input.ip)),
      userAgent: (input.userAgent || existing?.userAgent || '').slice(0, 500),
      browser: parsed.browser,
      os: parsed.os,
      device: parsed.device,
      loginAt: existing?.loginAt ?? input.loginAt ?? now,
      lastPingAt: now,
      exp:
        input.exp ||
        existing?.exp ||
        Math.floor(now / 1000) + ONLINE_PRESENCE_TTL_SEC,
      isSuperAdmin: input.isSuperAdmin ?? existing?.isSuperAdmin ?? false,
    };

    const ttl = this.calcTtl(session.exp);
    const pipeline = this.redis.pipeline();
    pipeline.set(
      this.sessionKey(session.jti),
      JSON.stringify(session),
      'EX',
      ttl,
    );
    pipeline.sadd(ONLINE_REDIS.INDEX, session.jti);
    pipeline.expire(ONLINE_REDIS.INDEX, Math.max(ttl, ONLINE_PRESENCE_TTL_SEC));
    await pipeline.exec();
    return session;
  }

  async touchPing(jti: string): Promise<OnlineSession | null> {
    const session = await this.getByJti(jti);
    if (!session) return null;
    session.lastPingAt = Date.now();
    const ttl = this.calcTtl(session.exp);
    await this.redis.set(
      this.sessionKey(jti),
      JSON.stringify(session),
      'EX',
      ttl,
    );
    return session;
  }

  async remove(jti: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(this.sessionKey(jti));
    pipeline.srem(ONLINE_REDIS.INDEX, jti);
    await pipeline.exec();
  }

  async removeByUserId(userId: string): Promise<string[]> {
    const list = await this.listRaw();
    const targets = list.filter((item) => item.userId === userId);
    if (!targets.length) return [];
    const pipeline = this.redis.pipeline();
    for (const item of targets) {
      pipeline.del(this.sessionKey(item.jti));
      pipeline.srem(ONLINE_REDIS.INDEX, item.jti);
    }
    await pipeline.exec();
    return targets.map((item) => item.jti);
  }

  async getByJti(jti: string): Promise<OnlineSession | null> {
    try {
      const raw = await this.redis.get(this.sessionKey(jti));
      if (!raw) return null;
      return JSON.parse(raw) as OnlineSession;
    } catch {
      return null;
    }
  }

  async list(
    keyword?: string,
    operatorUserId?: string,
  ): Promise<OnlineListResult> {
    const sessions = await this.listRaw();
    const now = Date.now();
    let list: OnlineUserItem[] = sessions.map((item) => {
      const isSelf = !!operatorUserId && item.userId === operatorUserId;
      const isSuperAdmin = !!item.isSuperAdmin;
      return {
        ...item,
        isSuperAdmin,
        status: this.resolveStatus(item, now),
        isSelf,
        kickable: !isSelf && !isSuperAdmin,
      };
    });

    if (keyword?.trim()) {
      const q = keyword.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.username.toLowerCase().includes(q) ||
          item.phone.includes(q) ||
          item.ip.includes(q) ||
          (item.location ?? '').toLowerCase().includes(q) ||
          item.browser.toLowerCase().includes(q) ||
          item.os.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => b.lastPingAt - a.lastPingAt);

    return {
      list,
      total: list.length,
      onlineCount: list.filter((item) => item.status === 'online').length,
      awayCount: list.filter((item) => item.status === 'away').length,
    };
  }

  /**
   * 强制下线保护：不可踢自己、不可踢超级管理员。
   */
  async assertCanKick(
    operatorUserId: string,
    targetUserId: string,
    options?: { targetJti?: string; operatorJti?: string },
  ): Promise<void> {
    if (!operatorUserId || !targetUserId) {
      throw new BadRequestException('无效的下线目标');
    }
    if (targetUserId === operatorUserId) {
      throw new BadRequestException('不能强制下线自己');
    }
    if (
      options?.operatorJti &&
      options?.targetJti &&
      options.operatorJti === options.targetJti
    ) {
      throw new BadRequestException('不能强制下线当前会话');
    }

    const session = options?.targetJti
      ? await this.getByJti(options.targetJti)
      : null;
    if (session?.isSuperAdmin) {
      throw new BadRequestException('不能强制下线超级管理员');
    }
    if (await this.isSuperAdminUser(targetUserId)) {
      throw new BadRequestException('不能强制下线超级管理员');
    }
  }

  async isSuperAdminUser(userId: string): Promise<boolean> {
    const count = await this.pgService.userRole.count({
      where: {
        userId,
        role: { code: SUPER_ADMIN_ROLE, enabled: true },
      },
    });
    return count > 0;
  }

  /** 校验 jti 归属后，吊销指定会话并清理 presence，返回需通知的 jti 列表 */
  async terminateSessionByOperator(
    operator: { id: string; jti?: string },
    target: { userId: string; jti: string },
  ): Promise<string[]> {
    const session = await this.getByJti(target.jti);
    if (!session) {
      throw new BadRequestException('会话不存在或已下线');
    }
    if (session.userId !== target.userId) {
      throw new BadRequestException('会话与用户不匹配');
    }
    await this.assertCanKick(operator.id, session.userId, {
      targetJti: session.jti,
      operatorJti: operator.jti,
    });

    await Promise.all([
      this.tokenService.revoke(session.userId, session.jti),
      this.rtTokenService.revoke(session.userId, session.jti),
    ]);
    await this.remove(session.jti);
    return [session.jti];
  }

  /** 操作者强制下线某用户全部会话 */
  async terminateUserByOperator(
    operatorId: string,
    targetUserId: string,
  ): Promise<string[]> {
    await this.assertCanKick(operatorId, targetUserId);
    return this.terminateUser(targetUserId);
  }

  /**
   * 无操作者校验：改密 / 禁用 / 系统回收时使用。
   * 吊销全部 token + 清理 presence。
   */
  async terminateUser(userId: string): Promise<string[]> {
    const jtis = await this.removeByUserId(userId);
    await Promise.all([
      this.tokenService.revokeAll(userId),
      this.rtTokenService.revokeAll(userId),
    ]);
    return jtis;
  }

  private async listRaw(): Promise<OnlineSession[]> {
    let jtis: string[] = [];
    try {
      jtis = await this.redis.smembers(ONLINE_REDIS.INDEX);
    } catch (error) {
      this.logger.warn(
        `读取在线索引失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
    if (!jtis.length) return [];

    const pipeline = this.redis.pipeline();
    for (const jti of jtis) {
      pipeline.get(this.sessionKey(jti));
    }
    const rows = await pipeline.exec();
    const stale: string[] = [];
    const sessions: OnlineSession[] = [];

    jtis.forEach((jti, index) => {
      const result = rows?.[index];
      const raw = result?.[1];
      if (typeof raw !== 'string' || !raw) {
        stale.push(jti);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as OnlineSession;
        sessions.push({
          ...parsed,
          isSuperAdmin: !!parsed.isSuperAdmin,
        });
      } catch {
        stale.push(jti);
      }
    });

    if (stale.length) {
      await this.redis.srem(ONLINE_REDIS.INDEX, ...stale);
    }

    return sessions;
  }

  private resolveStatus(
    session: OnlineSession,
    now = Date.now(),
  ): OnlineStatus {
    return now - session.lastPingAt <= ONLINE_AWAY_MS ? 'online' : 'away';
  }

  private calcTtl(exp: number): number {
    const remain = exp - Math.floor(Date.now() / 1000);
    if (!Number.isFinite(remain) || remain <= 0) return ONLINE_PRESENCE_TTL_SEC;
    return Math.min(Math.max(remain, ONLINE_PRESENCE_TTL_SEC), 7 * 24 * 3600);
  }
}
