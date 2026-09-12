import { Prisma } from '@/generated/prisma/client.js';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { lookupIpLocation } from '@/processor/utils/index.js';
import type { LoggerService } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import {
  sanitizeAuditMetadata,
  type AuditRecordInput,
} from './audit-log.sanitize.js';
import { QueryAuditLogParams } from './logger.dto.js';

@Injectable()
export class AuditLogService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly pgService: PgService,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.pgService.auditLog.create({
        data: {
          userId: input.actorId ?? null,
          action: input.action.slice(0, 80),
          resource: input.resource.slice(0, 100),
          resourceId: input.resourceId?.slice(0, 64) ?? null,
          success: input.success ?? true,
          ip: input.ip?.slice(0, 45) ?? null,
          location: await lookupIpLocation(input.ip),
          metadata:
            input.metadata == null
              ? Prisma.DbNull
              : (sanitizeAuditMetadata(
                  input.metadata,
                ) as Prisma.InputJsonValue),
        },
      });
    } catch (error) {
      this.logger.error(
        '写入领域审计日志失败',
        error instanceof Error ? error.stack : String(error),
        AuditLogService.name,
      );
    }
  }

  async getAuditLogList(searchParam: QueryAuditLogParams) {
    const {
      pageIndex,
      pageSize,
      action,
      resource,
      resourceId,
      success,
      dateRange,
    } = searchParam;
    const skip = (pageIndex - 1) * pageSize;
    const take = pageSize;
    const where: Prisma.AuditLogWhereInput = {};

    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (success !== undefined) where.success = success;
    if (dateRange) {
      const [start, end] = dateRange;
      where.createdAt = {
        gte: new Date(start),
        lte: new Date(end),
      };
    }

    const [list, total] = await Promise.all([
      this.pgService.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          user: {
            select: {
              username: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.pgService.auditLog.count({ where }),
    ]);
    return { list, total, message: '获取操作日志成功' };
  }
}
