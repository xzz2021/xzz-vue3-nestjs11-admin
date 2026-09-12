import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor() {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userRoleIds = request.user.roleIds;

    const isSuperAdmin = userRoleIds.includes(1);

    if (!isSuperAdmin) {
      throw new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED);
    }

    return true;
  }
}
