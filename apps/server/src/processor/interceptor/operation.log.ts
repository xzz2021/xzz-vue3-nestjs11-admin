import { LogService } from '#/core/logger/logger.service.js';
import { parseException } from '#/processor/filter/exception.util.js';
import { extractIP } from '#/processor/utils/string.js';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

const LOG_SKIP_PATHS = [
  '/log/getUserOperationLogList',
  '/log/deleteUserOperationLog',
  '/log/getAuditLogList',
  '/sse',
  '/auth/refresh',
  '/monitor',
  '/online',
  '/message',
  '/health',
];

interface JwtUser {
  id: string;
  username: string;
  phone: string;
}

interface RequestWithUser extends Request {
  user?: JwtUser;
}

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(private readonly logService: LogService) {}

  private shouldSkipLog(url: string): boolean {
    const path = url.split('?')[0];
    return LOG_SKIP_PATHS.some((item) => path.includes(item));
  }

  private normalizeUrl(url: string): string {
    return url.split('?')[0].slice(0, 255);
  }

  private extractSuccessMessage(data: unknown): string | null {
    if (data == null || typeof data !== 'object') return null;
    const msg = (data as Record<string, unknown>).message;
    if (typeof msg === 'string') return msg.slice(0, 500);
    return null;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithUser>();
    const { method, url, ip, headers, user } = request;
    const userAgent = (headers['user-agent'] as string) ?? '';
    const userId = user?.id ?? null;

    if (this.shouldSkipLog(url)) {
      return next.handle();
    }

    const baseLog = {
      userId,
      method,
      ip: extractIP(ip ?? ''),
      userAgent,
      requestUrl: this.normalizeUrl(url),
    };

    return next.handle().pipe(
      tap((data: unknown) => {
        void this.logService.addUserOperationLog({
          ...baseLog,
          responseMsg: this.extractSuccessMessage(data),
          detailInfo: null,
          isSuccess: true,
          duration: Date.now() - start,
        });
      }),
      catchError((err: unknown) => {
        const parsed = parseException(err);
        void this.logService.addUserOperationLog({
          ...baseLog,
          responseMsg: parsed.message.slice(0, 500),
          detailInfo: {
            statusCode: parsed.status,
            meta: parsed.meta,
          },
          isSuccess: false,
          duration: Date.now() - start,
        });
        return throwError(() => err);
      }),
    );
  }
}
