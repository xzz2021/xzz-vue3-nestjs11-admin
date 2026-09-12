import { MessageType, Prisma } from '@/generated/prisma/client.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageDeliveryService } from './message-delivery.service.js';
import { MessageRepository } from './message.repository.js';
import type { MessageListItem } from './message.types.js';

@Injectable()
export class MessageService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly delivery: MessageDeliveryService,
  ) {}

  async list(
    userId: string,
    query: {
      pageIndex?: number;
      pageSize?: number;
      type?: MessageType;
      unreadOnly?: boolean;
    },
  ) {
    const pageIndex = Math.max(1, query.pageIndex ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.MessageWhereInput = { receiverId: userId };
    if (query.type) where.type = query.type;
    if (query.unreadOnly) where.readAt = null;

    const [list, total, unread] = await Promise.all([
      this.messages.findInboxPage(where, (pageIndex - 1) * pageSize, pageSize),
      this.messages.count(where),
      this.delivery.getUnreadCount(userId),
    ]);

    return {
      list: list as MessageListItem[],
      total,
      unread,
      pageIndex,
      pageSize,
      message: '获取消息列表成功',
    };
  }

  getUnreadCount(userId: string) {
    return this.delivery.getUnreadCount(userId);
  }

  async markRead(userId: string, ids: string[]) {
    if (!ids.length) throw new BadRequestException('请选择消息');
    const result = await this.messages.markRead(userId, ids);
    const unread = await this.delivery.refreshUnread(userId);
    return { message: '已标记已读', count: result.count, unread };
  }

  async markAllRead(userId: string) {
    const result = await this.messages.markAllRead(userId);
    await this.delivery.setUnread(userId, 0);
    return { message: '已全部标记已读', count: result.count, unread: 0 };
  }

  async remove(userId: string, ids: string[]) {
    if (!ids.length) throw new BadRequestException('请选择消息');
    const result = await this.messages.deleteMany(userId, ids);
    const unread = await this.delivery.refreshUnread(userId);
    return { message: '删除成功', count: result.count, unread };
  }

  async searchReceivers(keyword?: string, excludeUserId?: string) {
    const list = await this.messages.searchReceivers(keyword, excludeUserId);
    return { list, message: 'ok' };
  }
}
