import { Controller, Get, Res } from '@nestjs/common';
import { CaptchaService } from './captcha.service.js';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '#/processor/decorator/index.js';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
@Controller('captcha')
@Public()
@ApiTags('验证码')
@Throttle({ default: { limit: 10, ttl: 50000 } })
export class CaptchaController {
  constructor(private captchaService: CaptchaService) {}

  /**
   * 字母图形验证码
   */
  @Get('/common')
  async getCaptcha(@Res({ passthrough: true }) res: Response) {
    const result = await this.captchaService.getCommon();
    this.captchaService.setCaptchaIdCookie(res, result.id);
    return { svg: result.svg };
  }

  /**
   * 数学公式图形验证码
   */
  @Get('/math_expr')
  async getMathExpr(@Res({ passthrough: true }) res: Response) {
    const result = await this.captchaService.getMathExpr();
    this.captchaService.setCaptchaIdCookie(res, result.id);
    return { svg: result.svg };
  }
}
