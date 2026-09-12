import { Module } from "@nestjs/common";
import { RoleController } from "./role.controller.js";
import { RoleRepository } from "./role.repository.js";
import { RoleService } from "./role.service.js";

@Module({
  controllers: [RoleController],
  providers: [RoleService, RoleRepository],
  exports: [RoleRepository],
})
export class RoleModule {}
