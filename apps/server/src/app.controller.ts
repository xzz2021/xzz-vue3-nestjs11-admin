import { RedisHealthService } from '#/infrastructure/database/redis/redis-health.service.js';
import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { Authenticated, Public } from '#/processor/decorator/index.js';
import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly pgService: PgService,
    private readonly redisHealthService: RedisHealthService,
  ) {}

  @Authenticated()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const [redisOk, dbOk] = await Promise.all([
      this.redisHealthService.ping(),
      this.pgService.ping(),
    ]);
    const ok = redisOk && dbOk;

    res.status(ok ? 200 : 503);

    return {
      code: ok ? 200 : 503,
      data: {
        status: ok ? 'ok' : 'degraded',
        redis: redisOk ? 'up' : 'down',
        database: dbOk ? 'up' : 'down',
      },
      message: ok ? '服务正常' : '部分依赖不可用',
    };
  }
}
