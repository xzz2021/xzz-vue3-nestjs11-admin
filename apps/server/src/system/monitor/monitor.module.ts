import { MessageModule } from "@/system/message/message.module.js";
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { MonitorErrorBuffer } from "./monitor-error.buffer.js";
import { MonitorLatencyInterceptor } from "./monitor-latency.interceptor.js";
import { MonitorLatencyTracker } from "./monitor-latency.tracker.js";
import { MonitorController } from "./monitor.controller.js";
import { MonitorGateway } from "./monitor.gateway.js";
import { MonitorService } from "./monitor.service.js";

@Module({
  imports: [ScheduleModule.forRoot(), JwtModule.register({}), MessageModule],
  controllers: [MonitorController],
  providers: [
    MonitorService,
    MonitorGateway,
    MonitorLatencyTracker,
    MonitorErrorBuffer,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitorLatencyInterceptor,
    },
  ],
  exports: [MonitorService, MonitorErrorBuffer],
})
export class MonitorModule {}
