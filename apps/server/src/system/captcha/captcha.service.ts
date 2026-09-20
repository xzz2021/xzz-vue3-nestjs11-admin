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
/** 匹配则 DEL；不匹配保留；缺失返回 0。大小写不敏感。 */
const CONSUME_CAPTCHA_SCRIPT = `
local stored = redis.call('GET', KEYS[1])
if not stored then
  return 0
end
if string.lower(stored) == string.lower(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return 1
end
return -1
`;
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
    const result = Number(
      await this.redis.eval(
        CONSUME_CAPTCHA_SCRIPT,
        1,
        `captchaId:${id}`,
        text,
      ),
    );
    if (result === 0) {
      // 如果拿不到 说明是过期了
      throw new BadRequestException('验证码已过期');
    }
    // 核对成功立即消费，避免 TTL 内重放；密码错误需重新获取验证码
    return result === 1;
  }
}
