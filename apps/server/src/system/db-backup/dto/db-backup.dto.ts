import { DbBackupConfigModel } from '@/generated/zod/index.js';
import { BackupStatus, BackupTrigger } from '@/generated/prisma/client.js';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  DB_BACKUP_DEFAULT_CRON,
  DB_BACKUP_DEFAULT_GZIP,
  DB_BACKUP_DEFAULT_PREFIX,
  DB_BACKUP_DEFAULT_RETENTION_MAX,
  DB_BACKUP_DEFAULT_TIMEZONE,
  DB_BACKUP_MAX_PAGE_SIZE,
} from '../db-backup.constants.js';

const cronSchema = z
  .string()
  .trim()
  .min(9)
  .max(100)
  .refine((value) => isValidCron(value), 'Cron 表达式格式不正确')
  .meta({ description: 'Cron 表达式', example: '0 0 * * * *' });

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine((value) => isValidTimezone(value), '时区格式不正确')
  .meta({ description: 'IANA 时区', example: 'Asia/Shanghai' });

const prefixSchema = DbBackupConfigModel.shape.filePrefix
  .trim()
  .refine(
    (value) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value),
    '文件名前缀只能包含字母、数字、点、下划线、中划线',
  );

const UpdateBackupConfigSchema = z.object({
  enabled: z
    .boolean()
    .optional()
    .default(true)
    .meta({ description: '是否启用定时备份', example: true }),
  cron: cronSchema.optional().default(DB_BACKUP_DEFAULT_CRON),
  timezone: timezoneSchema.optional().default(DB_BACKUP_DEFAULT_TIMEZONE),
  retentionMax: z.coerce
    .number()
    .int()
    .min(1)
    .max(999)
    .optional()
    .default(DB_BACKUP_DEFAULT_RETENTION_MAX)
    .meta({ description: '最大保留数量', example: 24 }),
  filePrefix: prefixSchema.optional().default(DB_BACKUP_DEFAULT_PREFIX),
  gzip: z
    .boolean()
    .optional()
    .default(DB_BACKUP_DEFAULT_GZIP)
    .meta({ description: '是否压缩', example: true }),
});
export class UpdateBackupConfigDto extends createZodDto(
  UpdateBackupConfigSchema,
) {}

const BackupJobQuerySchema = z.object({
  pageIndex: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .meta({ description: '页码', example: 1 }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(DB_BACKUP_MAX_PAGE_SIZE)
    .optional()
    .default(10)
    .meta({ description: '每页条数', example: 10 }),
  status: z
    .nativeEnum(BackupStatus)
    .optional()
    .meta({ description: '状态', example: 'SUCCESS' }),
  trigger: z
    .nativeEnum(BackupTrigger)
    .optional()
    .meta({ description: '触发方式', example: 'MANUAL' }),
});
export class BackupJobQueryDto extends createZodDto(BackupJobQuerySchema) {}

const BackupIdSchema = z.object({
  id: z.string().min(1).meta({ description: '任务 ID', example: 'cuid123' }),
});
export class BackupJobIdDto extends createZodDto(BackupIdSchema) {}

function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isValidCron(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return false;
  return parts.every((part) => part.length > 0);
}
