import { RtTokenService } from '#/system/auth/rt.token.service.js';
import { TokenService } from '#/system/auth/token.service.js';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isPublicRoute } from './is-public.js';

// 用于全局 配合 短token 拦截
@Injectable()
export class RtJwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, context)) return true;

    // WebSocket 走各自 Gateway 鉴权，避免 HTTP Guard 误伤
    if (context.getType?.() === 'ws') {
      return false;
    }

    const request = context.switchToHttp().getRequest();

    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;
    // 验签后检查双通道黑名单，被踢的 access token 立刻 401
    const jti = request.user?.jti as string | undefined;
    if (!jti) return true;

    if (
      (await this.tokenService.isBlacklisted(jti)) ||
      (await this.rtTokenService.isBlacklisted(jti))
    ) {
      throw new UnauthorizedException('token 已失效');
    }

    return true;
  }
}
