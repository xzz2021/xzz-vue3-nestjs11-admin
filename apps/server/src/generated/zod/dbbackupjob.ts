import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { BackupTrigger, BackupStatus } from "./enums"
import { CompleteUser, RelatedUserModel } from "./index"

export const DbBackupJobModel = z.object({
  id: z.string(),
  trigger: z.nativeEnum(BackupTrigger).meta({ description: '触发方式', example: 'MANUAL' }),
  status: z.nativeEnum(BackupStatus).meta({ description: '任务状态', example: 'RUNNING' }),
  fileName: z.string().min(1).max(255).meta({ description: '备份文件名', example: 'backstage_db_20260101_120000.sql.gz' }),
  filePath: z.string().min(1).max(500).meta({ description: '备份文件路径', example: '/app/apps/server/backups/backstage_db_20260101_120000.sql.gz' }),
  fileSize: z.bigint().optional().meta({ description: '备份文件大小（字节）', example: '1024' }).nullish(),
  checksum: z.string().length(64).optional().meta({ description: '文件 SHA-256 校验值', example: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }).nullish(),
  startedAt: z.coerce.date().meta({ description: '开始执行时间', example: '2026-01-01T12:00:00.000Z' }),
  finishedAt: z.coerce.date().optional().meta({ description: '执行完成时间', example: '2026-01-01T12:01:00.000Z' }).nullish(),
  durationMs: z.number().int().min(0).optional().meta({ description: '执行耗时（毫秒）', example: 1200 }).nullish(),
  errorMessage: z.string().max(2000).optional().meta({ description: '错误信息', example: 'spawn pg_dump ENOENT' }).nullish(),
  createdById: z.string().optional().meta({ description: '手动触发人用户 ID', example: 'clxxx' }).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class DbBackupJobDto extends createZodDto(DbBackupJobModel) {
}

export interface CompleteDbBackupJob extends z.infer<typeof DbBackupJobModel> {
  createdBy?: CompleteUser | null
}

/**
 * RelatedDbBackupJobModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedDbBackupJobModel: z.ZodType<CompleteDbBackupJob> = z.lazy(() => DbBackupJobModel.extend({
  createdBy: RelatedUserModel.nullish(),
}))
