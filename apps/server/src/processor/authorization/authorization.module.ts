import { RbacModule } from '#/processor/rbac/rbac.module.js';
import { DepartmentModule } from '#/system/department/department.module.js';
import { Module } from '@nestjs/common';
import { AuthorizationRepository } from './authorization.repository.js';
import { AuthorizationService } from './authorization.service.js';
import { AuthorizationSnapshotCacheService } from './authorization-snapshot-cache.service.js';
import { OrganizationGenerationModule } from './organization-generation.module.js';
import { ScopeResolverRegistry } from './scope-resolver.registry.js';

@Module({
  imports: [RbacModule, DepartmentModule, OrganizationGenerationModule],
  providers: [
    AuthorizationRepository,
    AuthorizationService,
    AuthorizationSnapshotCacheService,
    ScopeResolverRegistry,
  ],
  exports: [AuthorizationService, OrganizationGenerationModule],
})
export class AuthorizationModule {}
