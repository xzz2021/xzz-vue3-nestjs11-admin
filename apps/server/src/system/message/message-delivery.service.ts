import { MessageType, NoticeLevel, Prisma } from '#/generated/prisma/client.js';
import { isRichTextEmpty, sanitizeRichText } from '#/processor/utils/index.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import {
  MESSAGE_ALERT_DEBOUNCE_PREFIX,
  MESSAGE_JOB,
  MESSAGE_PUSH_CHANNEL,
  MESSAGE_QUEUE,
  MESSAGE_UNREAD_PREFIX,
  MESSAGE_UNREAD_TTL_SEC,
} from './message.constants.js';
import { MessageRepository } from './message.repository.js';
import type {
  MessageDispatchJob,
  MessagePushItem,
  MessagePushPayload,
} from './message.types.js';

@Injectable()
export class MessageDeliveryService {
  private readonly logger = new Logger(MessageDeliveryService.name);
  private readonly redis: Redis;

  constructor(
    private readonly messages: MessageRepository,
    redisService: RedisService,
    @InjectQueue(MESSAGE_QUEUE) private readonly queue: Queue,
  ) {
    this.redis = redisService.getOrThrow('default');
  }

  async enqueueMail(input: {
    senderId: string;
    receiverIds: string[];
    title: string;
    content: string;
    level?: NoticeLevel;
    meta?: Record<string, unknown>;
  }) {
    const receiverIds = [...new Set(input.receiverIds)];
    if (receiverIds.includes(input.senderId)) {
      throw new BadRequestException('不能给自己发送站内信');
    }
    const receivers = await this.messages.findEnabledUserIdsByIds(receiverIds);
    if (receivers.length !== receiverIds.length) {
      throw new BadRequestException('部分接收人不存在或已禁用');
    }

    await this.addJob({
      type: MessageType.MAIL,
      title: input.title,
      content: input.content,
      level: input.level ?? NoticeLevel.INFO,
      senderId: input.senderId,
      receiverIds,
      meta: input.meta ?? null,
    });
    return {
      message: `站内信已加入发送队列，共 ${receiverIds.length} 位接收人`,
    };
  }

  async enqueueSystem(input: {
    senderId?: string;
    title: string;
    content: string;
    level?: NoticeLevel;
    meta?: Record<string, unknown>;
  }) {
    await this.addJob({
      type: MessageType.SYSTEM,
      title: input.title,
      content: input.content,
      level: input.level ?? NoticeLevel.INFO,
      senderId: input.senderId ?? null,
      meta: input.meta ?? null,
    });
    return { message: '系统通知已加入发送队列' };
  }

  async enqueueAlert(input: {
    title: string;
    content: string;
    level?: NoticeLevel;
    meta?: Record<string, unknown>;
  }) {
    await this.addJob({
      type: MessageType.ALERT,
      title: input.title,
      content: input.content,
      level: input.level ?? NoticeLevel.WARNING,
      senderId: null,
      meta: input.meta ?? null,
    });
    return { message: '告警通知已加入发送队列' };
  }

  /**
   * 监控等场景防抖告警：同一 key 在 ttlSec 内只入队一次。
   * 返回是否成功入队。
   */
  async enqueueAlertDebounced(
    debounceKey: string,
    input: {
      title: string;
      content: string;
      level?: NoticeLevel;
      meta?: Record<string, unknown>;
    },
    ttlSec = 600,
  ): Promise<boolean> {
    const key = `${MESSAGE_ALERT_DEBOUNCE_PREFIX}${debounceKey}`;
    try {
      const ok = await this.redis.set(key, '1', 'EX', ttlSec, 'NX');
      if (ok !== 'OK') return false;
    } catch (error) {
      this.logger.debug(
        `告警防抖锁失败，仍尝试发送: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      await this.enqueueAlert(input);
      return true;
    } catch (error) {
      this.logger.warn(
        `告警入队失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const key = `${MESSAGE_UNREAD_PREFIX}${userId}`;
    try {
      const cached = await this.redis.get(key);
      if (cached != null && Number.isFinite(Number(cached))) {
        return Math.max(0, Number(cached));
      }
    } catch {
      // fallback DB
    }
    return this.refreshUnread(userId);
  }

  async refreshUnread(userId: string): Promise<number> {
    const count = await this.messages.countUnread(userId);
    await this.setUnread(userId, count);
    return count;
  }

  /** 缓存未命中时以 DB 为准（新消息已落库），避免 incr 从 0 起算导致少计 */
  async syncUnreadFromDb(userIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(userIds)];
    const result = new Map<string, number>();
    if (!unique.length) return result;

    const grouped = await this.messages.groupUnreadByReceiverIds(unique);
    const countMap = new Map(
      grouped.map((item) => [item.receiverId, item._count._all]),
    );
    for (const userId of unique) {
      const count = countMap.get(userId) ?? 0;
      result.set(userId, count);
      await this.setUnread(userId, count);
    }
    return result;
  }

  async setUnread(userId: string, count: number): Promise<void> {
    const key = `${MESSAGE_UNREAD_PREFIX}${userId}`;
    try {
      await this.redis.set(
        key,
        String(Math.max(0, count)),
        'EX',
        MESSAGE_UNREAD_TTL_SEC,
      );
    } catch {
      // ignore
    }
  }

  async resolveReceivers(job: MessageDispatchJob): Promise<string[]> {
    if (job.type === MessageType.MAIL) {
      return [...new Set(job.receiverIds ?? [])];
    }
    if (job.type === MessageType.ALERT) {
      const admins = await this.messages.findSuperAdminUserIds();
      return admins.map((item) => item.id);
    }
    const users = await this.messages.findEnabledUserIds();
    return users.map((item) => item.id);
  }

  /** Worker：落库、刷新未读、发布 WS 推送 */
  async dispatch(data: MessageDispatchJob): Promise<{ count: number }> {
    const receiverIds = await this.resolveReceivers(data);
    if (!receiverIds.length) {
      this.logger.warn(
        `消息任务无接收人 type=${data.type} title=${data.title}`,
      );
      return { count: 0 };
    }

    const level =
      data.level ??
      (data.type === MessageType.ALERT
        ? NoticeLevel.WARNING
        : NoticeLevel.INFO);
    const now = new Date();
    const rows: Prisma.MessageCreateManyInput[] = receiverIds.map(
      (receiverId) => ({
        dispatchId: data.dispatchId,
        type: data.type,
        title: data.title.slice(0, 200),
        content: data.content,
        level,
        senderId: data.senderId ?? null,
        receiverId,
        meta:
          data.meta == null
            ? Prisma.DbNull
            : (data.meta as Prisma.InputJsonValue),
        createdAt: now,
      }),
    );

    const batchSize = 200;
    const created: Awaited<ReturnType<MessageRepository['insertDispatched']>> =
      [];
    for (let i = 0; i < rows.length; i += batchSize) {
      const inserted = await this.messages.insertDispatched(
        rows.slice(i, i + batchSize),
      );
      created.push(...inserted);
    }

    const unreadMap = await this.syncUnreadFromDb(receiverIds);
    await this.publishCreated(created, unreadMap);
    return { count: created.length };
  }

  /** 所有入队路径的唯一出口，在此统一清洗，保证落库内容不含 XSS 载荷 */
  private async addJob(payload: Omit<MessageDispatchJob, 'dispatchId'>) {
    const title = payload.title.trim();
    const content = sanitizeRichText(payload.content);
    if (!title || isRichTextEmpty(content)) {
      throw new BadRequestException('消息标题和内容不能为空');
    }

    const dispatchId = randomUUID();
    const job = {
      ...payload,
      title,
      content,
      dispatchId,
    } satisfies MessageDispatchJob;
    await this.queue.add(MESSAGE_JOB, job, {
      jobId: dispatchId,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  private async publishCreated(
    created: Awaited<ReturnType<MessageRepository['insertDispatched']>>,
    unreadMap: Map<string, number>,
  ) {
    const byUser = new Map<string, typeof created>();
    for (const item of created) {
      const list = byUser.get(item.receiverId) ?? [];
      list.push(item);
      byUser.set(item.receiverId, list);
    }

    for (const [userId, items] of byUser) {
      const payload: MessagePushPayload = {
        userId,
        unread: unreadMap.get(userId) ?? items.length,
        items: items.map((m): MessagePushItem => ({
          id: m.id,
          type: m.type,
          title: m.title,
          content: m.content.slice(0, 200),
          level: m.level,
          createdAt: m.createdAt.toISOString(),
          senderId: m.senderId,
          senderName: m.sender?.username ?? null,
        })),
      };
      try {
        await this.redis.publish(MESSAGE_PUSH_CHANNEL, JSON.stringify(payload));
      } catch (error) {
        this.logger.warn(
          `消息推送发布失败 user=${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
