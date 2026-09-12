import { Prisma } from '@/generated/prisma/client.js';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MessageRepository {
  constructor(private readonly db: PgService) {}

  findEnabledUserIdsByIds(ids: string[]) {
    return this.db.user.findMany({
      where: { id: { in: ids }, enabled: true },
      select: { id: true },
    });
  }

  findEnabledUserIds() {
    return this.db.user.findMany({
      where: { enabled: true },
      select: { id: true },
    });
  }

  findSuperAdminUserIds() {
    return this.db.user.findMany({
      where: {
        enabled: true,
        roles: { some: { role: { code: 'super_admin', enabled: true } } },
      },
      select: { id: true },
    });
  }

  searchReceivers(keyword?: string, excludeUserId?: string) {
    const q = keyword?.trim();
    return this.db.user.findMany({
      where: {
        enabled: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        ...(q
          ? {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { nickname: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      select: { id: true, username: true, nickname: true, phone: true },
      orderBy: { username: 'asc' },
    });
  }

  findInboxPage(where: Prisma.MessageWhereInput, skip: number, take: number) {
    return this.db.message.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true } },
      },
    });
  }

  count(where: Prisma.MessageWhereInput) {
    return this.db.message.count({ where });
  }

  countUnread(userId: string) {
    return this.db.message.count({
      where: { receiverId: userId, readAt: null },
    });
  }

  groupUnreadByReceiverIds(userIds: string[]) {
    return this.db.message.groupBy({
      by: ['receiverId'],
      where: { receiverId: { in: userIds }, readAt: null },
      _count: { _all: true },
    });
  }

  insertDispatched(data: Prisma.MessageCreateManyInput[]) {
    return this.db.message.createManyAndReturn({
      data,
      skipDuplicates: true,
      include: { sender: { select: { id: true, username: true } } },
    });
  }

  markRead(userId: string, ids: string[]) {
    return this.db.message.updateMany({
      where: { id: { in: ids }, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.db.message.updateMany({
      where: { receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  deleteMany(userId: string, ids: string[]) {
    return this.db.message.deleteMany({
      where: { id: { in: ids }, receiverId: userId },
    });
  }
}
