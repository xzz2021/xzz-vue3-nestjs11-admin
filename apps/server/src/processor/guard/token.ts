import { TokenService } from '#/system/auth/token.service.js';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isPublicRoute } from './is-public.js';

//   配合   JwtStrategy 使用   JwtStrategy  注入到module里
@Injectable()
export class TokenGuard extends AuthGuard('token') {
  constructor(
    private reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ok =
      isPublicRoute(this.reflector, context) ||
      ((await super.canActivate(context)) as boolean);
    if (!ok) return false;
    const user = request.user;
    const userId = user?.sub as string;
    const jti = user?.jti as string;

    if (!userId || !jti) {
      throw new UnauthorizedException('---Invalid token payload');
    }

    // 1) 黑名单校验：被撤销/踢下线的会话直接 401
    if (await this.tokenService.isBlacklisted(jti)) {
      throw new UnauthorizedException('Token 已失效');
    }

    // 2) 仍在该用户的会话列表中（避免已被逐出的旧会话继续访问）
    const list = await this.tokenService.listSessions(userId);
    if (!list.includes(jti)) {
      throw new UnauthorizedException('token not active');
    }

    return true;

    // 在return boolean 之前 可以做 一些 权限校验 或者 数据处理 request['anyobject'] = {aaa: 000};
  }

  /**
   * 自定义处理 JWT 验证通过后的逻辑
   * 自动挂载任意新数据到  @Request 上
   * 主动失效token  直接抛出异常
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token 无效或未提供');
    }

    // ✅ 自定义逻辑：举个例子，禁止被禁用用户访问
    if (user.status === 'banned') {
      throw new UnauthorizedException('用户已被禁用');
    }

    // ✅ 加工 user 对象：可以扩展更多字段或做权限检查
    // user.roles = user.roles || [];
    // user.extra = { checked: true };

    // 可以在此设置给 request 对象
    // const req = context.switchToHttp().getRequest();
    // req.currentUser = user; // 自定义字段，控制器里可通过 req.currentUser 获取

    return user;
  }
}
