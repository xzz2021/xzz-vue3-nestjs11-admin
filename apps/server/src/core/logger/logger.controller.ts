import { RequiredPermission, Serialize } from "@/processor/decorator";
import { Body, Controller, Delete, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuditLogService } from "./audit-log.service";
import {
  AuditLogListResDto,
  DeleteLogDto,
  LogListResDto,
  QueryAuditLogParams,
  QueryLogParams,
} from "./logger.dto";
import { LogService } from "./logger.service";

@ApiTags("日志")
@Controller("log")
export class LoggerController {
  constructor(
    private readonly loggerService: LogService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get("getUserOperationLogList")
  @RequiredPermission("userLog:view")
  @ApiOperation({ summary: "获取访问日志列表" })
  @Serialize(LogListResDto)
  @ApiResponse({ type: LogListResDto, isArray: true })
  getUserOperationLogList(@Query() params: QueryLogParams) {
    return this.loggerService.getUserOperationLogList(params);
  }

  @Delete("deleteUserOperationLog")
  @RequiredPermission("userLog:delete")
  @ApiOperation({ summary: "删除访问日志" })
  deleteUserOperationLog(@Body() obj: DeleteLogDto) {
    return this.loggerService.deleteUserOperationLog(obj);
  }

  @Get("getAuditLogList")
  @RequiredPermission("auditLog:view")
  @ApiOperation({ summary: "获取操作日志列表（领域审计，不可删除）" })
  @Serialize(AuditLogListResDto)
  @ApiResponse({ type: AuditLogListResDto, isArray: true })
  getAuditLogList(@Query() params: QueryAuditLogParams) {
    return this.auditLogService.getAuditLogList(params);
  }
}
