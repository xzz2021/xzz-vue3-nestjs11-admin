import { RedisService } from '@liaoliaots/nestjs-redis';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import * as SvgCaptcha from 'svg-captcha';
import { CaptchaGenerateResult } from './captcha.module-definition.js';

export const CAPTCHA_ID_COOKIE = 'captchaId';
export const CAPTCHA_TEXT_COOKIE = 'captchaText';
const CAPTCHA_COOKIE_MAX_AGE = 5 * 60 * 1000;
const CAPTCHA_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: CAPTCHA_COOKIE_MAX_AGE,
};

@Injectable()
export class CaptchaService {
  private readonly redis: Redis;
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  async getCommon(): Promise<CaptchaGenerateResult> {
    const id = randomUUID();
    const { data, text } = SvgCaptcha.create({
      // height: 25,
      ignoreChars: '0oO1iIl',
      color: true,
    });
    //写入redis存储
    await this.redis.set(
      `captchaId:${id}`,
      text,
      'EX',
      CAPTCHA_COOKIE_MAX_AGE / 1000,
    );
    //写入redis存储
    const svg = data.replaceAll('"', "'");
    return {
      id,
      svg,
    };
  }

  async getMathExpr(): Promise<CaptchaGenerateResult> {
    const id = randomUUID();
    const res = SvgCaptcha.createMathExpr({
      mathMax: 100,
      mathMin: -100,
    });
    //写入redis存储
    await this.redis.set(
      `captchaId:${id}`,
      res.text,
      'EX',
      CAPTCHA_COOKIE_MAX_AGE / 1000,
    );

    const svg = res.data.replaceAll('"', "'");
    return {
      id,
      svg,
    };
  }

  setCaptchaIdCookie(res: Response, id: string) {
    const options = {
      ...CAPTCHA_COOKIE_OPTIONS,
      secure: this.configService.get<boolean>('isProduction') ?? false,
    };
    res.cookie(CAPTCHA_ID_COOKIE, id, options);
    res.clearCookie(CAPTCHA_TEXT_COOKIE, options);
  }

  async verify(id: string, text: string): Promise<boolean> {
    if (!text) {
      return false;
    }
    const res = await this.redis.get(`captchaId:${id}`);
    if (!res) {
      // 如果拿不到 说明是过期了
      throw new BadRequestException('验证码已过期');
    }
    const ok = res.toLowerCase() === text.toLowerCase();
    // if (ok) {
    //   // 核对成功不需要删除 因为有可能是密码错误  删除就会导致重新生成验证码   且获取新的会自动覆写
    //   // eslint-disable-next-line @typescript-eslint/no-misused-promises
    //   setTimeout(() => this.redis.del(`captchaId:${id}`), 5 * 60 * 1000);
    // }
    return ok;
  }
}
