import { Authenticated, Public, SkipWrap } from '#/processor/decorator/index.js';
import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Authenticated()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @SkipWrap()
  @SkipThrottle()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const snapshot = await this.appService.checkHealth();
    res.status(snapshot.status === 'ok' ? 200 : 503);
    return snapshot;
  }
}
