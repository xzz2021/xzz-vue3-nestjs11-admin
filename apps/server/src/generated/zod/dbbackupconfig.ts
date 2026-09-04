import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { BackupStatus } from "./enums"

export const DbBackupConfigModel = z.object({
  id: z.string().meta({ description: '配置主键', example: 'default' }),
  enabled: z.boolean().optional().meta({ description: '是否启用定时备份', example: true }),
  cron: z.string().min(9).max(100).meta({ description: 'Cron 表达式', example: '0 0 * * * *' }),
  timezone: z.string().min(1).max(50).meta({ description: '时区', example: 'Asia/Shanghai' }),
  retentionMax: z.number().int().min(1).max(999).meta({ description: '最大保留数量', example: 24 }),
  filePrefix: z.string().min(1).max(80).meta({ description: '备份文件名前缀', example: 'backstage_db' }),
  gzip: z.boolean().optional().meta({ description: '是否启用 gzip 压缩', example: true }),
  lastRunAt: z.coerce.date().optional().meta({ description: '最近一次执行时间', example: '2026-01-01T12:00:00.000Z' }).nullish(),
  lastStatus: z.nativeEnum(BackupStatus).optional().meta({ description: '最近一次执行状态', example: 'SUCCESS' }).nullish(),
  lastError: z.string().max(1000).optional().meta({ description: '最近一次错误信息', example: 'pg_dump exited with code 1' }).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class DbBackupConfigDto extends createZodDto(DbBackupConfigModel) {
}
