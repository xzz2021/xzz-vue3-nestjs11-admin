// captcha.guard.ts
import {
  CAPTCHA_ID_COOKIE,
  CAPTCHA_TEXT_COOKIE,
  CaptchaService,
} from '#/system/captcha/captcha.service.js';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(private readonly svc: CaptchaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const captchaId = req.cookies?.[CAPTCHA_ID_COOKIE] as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const captchaText = req.cookies?.[CAPTCHA_TEXT_COOKIE] as
      string | undefined;
    if (!captchaId || !captchaText) {
      throw new BadRequestException('验证码已失效');
    }
    const ok: boolean = await this.svc.verify(captchaId, captchaText);
    if (!ok) {
      throw new BadRequestException('验证码有误');
    }
    return true;
  }
}
