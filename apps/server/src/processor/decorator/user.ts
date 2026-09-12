import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

/** 从 request.user 提取当前登录用户，支持 @User('id') 提取单个字段 */
export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: Record<string, unknown> }).user;
    return data ? user?.[data] : user;
  },
);

/*
@Get()
async findOne(@User('firstName') firstName: string) {
  console.log(`Hello ${firstName}`);
}
组合装饰器



import { applyDecorators } from '@nestjs/common';

export function Auth(...roles: Role[]) {
  return applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}
*/
