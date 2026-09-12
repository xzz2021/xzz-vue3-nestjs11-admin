import { Module } from "@nestjs/common";
import { RoleModule } from "#/system/role/role.module.js";
import { MenuController } from "./menu.controller.js";
import { MenuRepository } from "./menu.repository.js";
import { MenuService } from "./menu.service.js";

@Module({
  imports: [RoleModule],
  controllers: [MenuController],
  providers: [MenuService, MenuRepository],
})
export class MenuModule {}
