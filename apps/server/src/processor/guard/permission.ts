import type { AuthorizationContext } from '#/processor/authorization/authorization-context.js';
import { AuthorizationService } from '#/processor/authorization/authorization.service.js';
import { IS_AUTHENTICATED_KEY } from '#/processor/decorator/public.js';
import { PERMISSION_KEY } from '#/processor/decorator/permission.js';
import { isTransientDbError } from '#/processor/filter/prisma.exception.js';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isPublicRoute } from './is-public.js';
/*

此guard 通过rbac定义 控制了 所有 路由 调用 和 按钮操作 的权限

还需要casl 控制 更 细颗粒度 的 表格 及 字段 操作 的权限

*/
export interface AuthorizedJwtRequest extends Request {
  user?: {
    id?: string;
  };
  authorizationContext?: AuthorizationContext;
}

/** @deprecated 使用 AuthorizedJwtRequest。 */
export type AuthorizedRequest = AuthorizedJwtRequest;

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket 走各自 Gateway 鉴权，避免 HTTP Guard 误伤
    if (context.getType?.() === 'ws') {
      return true;
    }
    if (isPublicRoute(this.reflector, context)) return true;

    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(
        IS_AUTHENTICATED_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!authenticatedOnly) {
        throw new ForbiddenException('接口未配置访问权限');
      }
      const request = context.switchToHttp().getRequest<AuthorizedJwtRequest>();
      if (!request.user?.id) throw new ForbiddenException('身份无效，无法校验权限');
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthorizedJwtRequest>();
    const userId = request.user?.id;
    // 返回 false 时 Nest 会抛默认 ForbiddenException('Forbidden resource')，这里主动抛出以自定义文案
    if (!userId) throw new ForbiddenException('身份无效，无法校验权限');

    try {
      const authorizationContext = await this.authorization.createContext(
        userId,
        [requiredPermission],
      );
      request.authorizationContext = authorizationContext;
      // 上面是接口放行了, 这里开始细颗粒度权限判断
      if (!authorizationContext.hasPermission(requiredPermission)) {
        throw new ForbiddenException('无权限访问当前接口');
      }
      return true;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      if (isTransientDbError(error)) {
        throw new ServiceUnavailableException('数据库暂不可用，请稍后重试');
      }
      // Redis 短暂故障时也不要伪装成鉴权失败
      const msg = error instanceof Error ? error.message : String(error);
      if (
        /ECONNREFUSED|ECONNRESET|ETIMEDOUT|Connection is closed|READONLY/i.test(
          msg,
        )
      ) {
        throw new ServiceUnavailableException('缓存服务暂不可用，请稍后重试');
      }
      throw error;
    }
    // return permissions.includes(ALL_PERMISSIONS) || permissions.includes(requiredPermission)
  }
}
