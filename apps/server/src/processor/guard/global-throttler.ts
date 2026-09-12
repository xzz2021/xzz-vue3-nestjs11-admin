// custom-throttler.guard.ts
import { RATE_KEY } from '@/processor/decorator/rate-key.js';
import { getIp } from '@/processor/utils/ip.util.js';
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const REDIS_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

function isRedisUnavailableError(error: unknown): boolean {
  if (!error) return false;

  const messages: string[] = [];
  const codes: string[] = [];

  const collect = (err: unknown, depth = 0) => {
    if (!err || typeof err !== 'object' || depth > 3) return;
    const e = err as { code?: string; message?: string; cause?: unknown };
    if (e.code) codes.push(e.code);
    if (e.message) messages.push(e.message.toLowerCase());
    if (e.cause) collect(e.cause, depth + 1);
  };

  collect(error);

  if (codes.some((code) => REDIS_ERROR_CODES.has(code))) return true;

  const combined = messages.join(' ');
  return (
    combined.includes('redis') ||
    combined.includes('maxretries') ||
    combined.includes('connection is closed') ||
    combined.includes("stream isn't writeable") ||
    combined.includes('enableofflinequeue')
  );
}

//  guard 默认以ip作为key 重写guard则会以现有的返回值作为key进行hansh
@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType?.() === 'ws') return true;
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (isRedisUnavailableError(error)) {
        throw new ServiceUnavailableException(
          'Redis 服务不可用，请检查 Redis 是否已启动',
        );
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '请求限流服务异常',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getTracker(
    req: any,
    context?: ExecutionContext,
  ): Promise<string> {
    // 1. 优先读取装饰器指定的 key
    if (context) {
      const handlerKey = this.reflector.get<string>(
        RATE_KEY,
        context.getHandler(),
      );
      if (handlerKey) {
        return `custom:${handlerKey}`;
      }
    }

    // 2. 登录用户
    if (req.user?.id) return `u:${req.user.id}`;

    // 3. API Key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) return `k:${apiKey}`;

    // 4. 未登录：回退到 IP + UA，降低共享IP误伤（IP 走 trust proxy，不读原始 XFF）
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const ip = getIp(req) || req.connection?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || '';
    return `ip:${ip}|ua:${ua}`;
  }
}
