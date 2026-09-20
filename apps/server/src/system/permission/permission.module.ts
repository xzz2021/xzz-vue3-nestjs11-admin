import { RoleModule } from "#/system/role/role.module.js";
import { Module } from "@nestjs/common";
import { PermissionController } from "./permission.controller.js";
import { PermissionRepository } from "./permission.repository.js";
import { PermissionService } from "./permission.service.js";

@Module({
  imports: [RoleModule],
  controllers: [PermissionController],
  providers: [PermissionService, PermissionRepository],
})
export class PermissionModule {}
