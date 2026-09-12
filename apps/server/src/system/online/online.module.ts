import { SessionModule } from "#/system/session/session.module.js";
import { Module } from "@nestjs/common";
import { OnlineController } from "./online.controller.js";
import { OnlineGateway } from "./online.gateway.js";
import { OnlineSessionListener } from "./online.session.listener.js";
import { OnlineService } from "./online.service.js";

@Module({
  imports: [SessionModule],
  controllers: [OnlineController],
  providers: [OnlineService, OnlineGateway, OnlineSessionListener],
  exports: [OnlineService, OnlineGateway],
})
export class OnlineModule {}
