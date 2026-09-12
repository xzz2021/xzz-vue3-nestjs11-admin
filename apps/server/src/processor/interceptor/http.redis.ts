import { RedisService } from '@liaoliaots/nestjs-redis';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { Redis } from 'ioredis';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 自定义HTTP缓存拦截器
 * 只缓存GET请求，支持Redis和内存缓存
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 只缓存 GET 请求
    if (request.method !== 'GET') {
      return next.handle();
    }

    // 生成缓存键
    const cacheKey = this.generateCacheKey(request);

    // 尝试从缓存获取数据
    return await this.getFromCache(cacheKey)
      .then((cachedData) => {
        if (cachedData) {
          // 如果缓存命中，直接返回缓存数据
          response.setHeader('X-Cache', 'HIT');
          return of(cachedData);
        }

        // 缓存未命中，执行请求并缓存结果
        response.setHeader('X-Cache', 'MISS');
        return next.handle().pipe(
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          tap(async (data: any) => {
            // 异步缓存数据，不阻塞响应
            await this.setCache(cacheKey, data).catch((err) => {
              console.warn('缓存设置失败:', err.message);
            });
          }),
        );
      })
      .catch(() => {
        // 缓存服务异常时，直接执行请求
        return next.handle();
      });
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: Request): string {
    const { method, url, query, headers } = request;

    // 获取用户ID（如果有的话）
    const userId = (request as any).user?.id || 'anonymous';

    // 获取语言偏好
    const acceptLanguage = headers['accept-language'] || '';

    // 构建缓存键的组成部分
    const keyParts = [
      'http_cache',
      method.toLowerCase(),
      url.split('?')[0], // 移除查询参数，单独处理
      userId,
      acceptLanguage,
    ];

    // 如果有查询参数，按字母顺序排序后加入
    if (query && Object.keys(query).length > 0) {
      const sortedQuery = Object.keys(query)
        .sort()
        .map((key) => {
          const value = query[key];
          // 处理数组、多类型和对象
          if (Array.isArray(value)) {
            return value
              .map(
                (v) =>
                  `${key}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : String(v))}`,
              )
              .join('&');
          } else if (typeof value === 'object' && value !== null) {
            return `${key}=${encodeURIComponent(JSON.stringify(value))}`;
          } else if (typeof value === 'undefined') {
            return `${key}=`;
          } else {
            return `${key}=${encodeURIComponent(String(value))}`;
          }
        })
        .join('&');
      keyParts.push(sortedQuery);
    }

    // 生成最终的缓存键
    const keyString = keyParts.join(':');
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * 从缓存获取数据
   */
  private async getFromCache(key: string): Promise<any> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('缓存读取失败:', (error as Error).message);
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  private async setCache(key: string, data: any): Promise<void> {
    try {
      // 默认缓存时间：5分钟
      const ttl = 300; // 秒
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.warn('缓存写入失败:', (error as Error).message);
    }
  }
}

// 保留原有的类名以兼容现有代码
export class HttpCacheInterceptor000 extends HttpCacheInterceptor {}
