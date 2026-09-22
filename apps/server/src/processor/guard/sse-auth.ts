import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SseAuthGuard extends AuthGuard('sse') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    // console.log('-=---------------------', ok);
    // 2) 现在再读 user 才有值
    // const request = context.switchToHttp().getRequest();

    return ok;
  }

  /**
   * 自定义处理 JWT 验证通过后的逻辑
   * 自动挂载任意新数据到  @Request 上
   * 主动失效token  直接抛出异常
   */
  handleRequest(err: any, user: any, _info: any, _context: ExecutionContext) {
    // console.log('-=--------------useruser-------', user);

    // console.log('[sse guard] handleRequest err=', err, 'info=', info, 'user=', user);
    if (err || !user) {
      throw err || new UnauthorizedException('Token 无效或未提供');
    }

    return user;
  }
}
