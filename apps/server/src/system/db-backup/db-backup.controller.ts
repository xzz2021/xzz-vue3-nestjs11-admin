import { BackupTrigger } from "#/generated/prisma/client.js";
import { RequiredPermission, User } from "#/processor/decorator/index.js";
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createReadStream } from "node:fs";
import type { Response } from "express";

import {
  BackupJobIdDto,
  BackupJobQueryDto,
  UpdateBackupConfigDto,
} from "./dto/db-backup.dto.js";
import { DbBackupService } from "./db-backup.service.js";

@ApiTags("数据库备份")
@Controller("db-backup")
export class DbBackupController {
  constructor(private readonly dbBackupService: DbBackupService) {}

  @Get("config")
  @RequiredPermission("databaseBackup:view")
  @ApiOperation({ summary: "获取数据库备份配置" })
  getConfig() {
    return this.dbBackupService.getConfigPayload();
  }

  @Post("config")
  @RequiredPermission("databaseBackup:update")
  @ApiOperation({ summary: "更新数据库备份配置" })
  updateConfig(@Body() body: UpdateBackupConfigDto) {
    return this.dbBackupService.updateConfig(body);
  }

  @Post("run")
  @RequiredPermission("databaseBackup:run")
  @ApiOperation({ summary: "立即执行数据库备份" })
  run(@User("id") userId?: string) {
    return this.dbBackupService.enqueueBackup(BackupTrigger.MANUAL, userId);
  }

  @Get("jobs")
  @RequiredPermission("databaseBackup:view")
  @ApiOperation({ summary: "获取数据库备份任务列表" })
  list(@Query() query: BackupJobQueryDto) {
    return this.dbBackupService.listJobs(query);
  }

  @Get("download/:id")
  @RequiredPermission("databaseBackup:download")
  @Header("Content-Type", "application/octet-stream")
  @ApiOperation({ summary: "下载数据库备份文件" })
  async download(
    @Param() params: BackupJobIdDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const job = await this.dbBackupService.getJobFile(params.id);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(job.fileName)}"`,
    );
    return new StreamableFile(createReadStream(job.filePath));
  }

  @Delete("jobs/:id")
  @RequiredPermission("databaseBackup:delete")
  @ApiOperation({ summary: "删除数据库备份任务" })
  remove(@Param() params: BackupJobIdDto) {
    return this.dbBackupService.deleteJob(params.id);
  }

  @Post("cleanup")
  @RequiredPermission("databaseBackup:delete")
  @ApiOperation({ summary: "手动执行滚动清理" })
  cleanup() {
    return this.dbBackupService.cleanup();
  }
}
