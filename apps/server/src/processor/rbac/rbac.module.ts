import { Global, Module } from '@nestjs/common';
import { RbacPermissionCacheService } from './rbac-permission-cache.service.js';

@Global()
@Module({
  providers: [RbacPermissionCacheService],
  exports: [RbacPermissionCacheService],
})
export class RbacModule {}
