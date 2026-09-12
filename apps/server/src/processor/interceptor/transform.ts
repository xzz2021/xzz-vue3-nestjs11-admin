import { SKIP_WRAP_KEY } from '@/processor/decorator/skip-wrap.js';
import { wrapSuccess } from '@/processor/utils/response.model.js';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const skipWrap = this.reflector.getAllAndOverride<boolean>(SKIP_WRAP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipWrap) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile || data instanceof ReadableStream) {
          return data;
        }
        return wrapSuccess(data);
      }),
    );
  }
}
