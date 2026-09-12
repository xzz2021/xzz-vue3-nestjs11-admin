import { Prisma } from '#/generated/prisma/client.js';
import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { lookupIpLocation } from '#/processor/utils/index.js';
import type { LoggerService } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DeleteLogDto, QueryLogParams } from './logger.dto.js';

@Injectable()
export class LogService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
    private readonly pgService: PgService,
  ) {}

  async addUserOperationLog(data: {
    userId: string | null;
    method: string;
    ip: string;
    userAgent: string;
    requestUrl: string;
    responseMsg?: string | null;
    detailInfo?: Record<string, unknown> | null;
    isSuccess: boolean;
    duration: number;
  }) {
    try {
      await this.pgService.userOperationLog.create({
        data: {
          userId: data.userId,
          method: data.method.slice(0, 10),
          ip: data.ip.slice(0, 50),
          location: await lookupIpLocation(data.ip),
          userAgent: data.userAgent.slice(0, 500),
          requestUrl: data.requestUrl.slice(0, 255),
          isSuccess: data.isSuccess,
          responseMsg: data.responseMsg?.slice(0, 500) ?? null,
          detailInfo:
            data.detailInfo == null
              ? Prisma.DbNull
              : (data.detailInfo as Prisma.InputJsonValue),
          duration: data.duration,
        },
      });
    } catch (error) {
      this.logger.error(
        '写入用户操作日志失败',
        error instanceof Error ? error.stack : String(error),
        LogService.name,
      );
    }
  }

  async getUserOperationLogList(searchParam: QueryLogParams) {
    const { pageIndex, pageSize, isSuccess, method, requestUrl, dateRange } =
      searchParam;
    const skip = (pageIndex - 1) * pageSize;
    const take = pageSize;
    const where: Prisma.UserOperationLogWhereInput = {};

    if (isSuccess !== undefined) {
      where.isSuccess = isSuccess;
    }
    if (method) {
      where.method = method;
    }
    if (requestUrl) {
      where.requestUrl = { contains: requestUrl };
    }
    if (dateRange) {
      const [start, end] = dateRange;
      where.createdAt = {
        gte: new Date(start),
        lte: new Date(end),
      };
    }

    const [list, total] = await Promise.all([
      this.pgService.userOperationLog.findMany({
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
        orderBy: { id: 'desc' },
      }),
      this.pgService.userOperationLog.count({ where }),
    ]);
    return { list, total, message: '获取日志列表成功' };
  }

  async deleteUserOperationLog(obj: DeleteLogDto) {
    await this.pgService.userOperationLog.deleteMany({
      where: { id: { in: obj.ids } },
    });
    return { message: '删除用户操作日志成功' };
  }
}
