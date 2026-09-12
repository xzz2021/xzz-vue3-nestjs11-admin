import { RoleModule } from "@/system/role/role.module.js";
import { Module } from "@nestjs/common";
import { PermissionController } from "./permission.controller.js";
import { PermissionService } from "./permission.service.js";

@Module({
  imports: [RoleModule],
  controllers: [PermissionController],
  providers: [PermissionService],
})
export class PermissionModule {}
