import { RequiredPermission } from "#/processor/decorator/index.js";
import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { MonitorService } from "./monitor.service.js";

@ApiTags("系统监控")
@Controller("monitor")
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get("snapshot")
  @RequiredPermission("server:view")
  @ApiOperation({ summary: "获取监控快照（含近 1 小时指标与异常）" })
  getSnapshot() {
    return this.monitorService.getPayload();
  }
}
