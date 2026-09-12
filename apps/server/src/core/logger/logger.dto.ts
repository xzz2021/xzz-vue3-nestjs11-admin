import { AuditLogModel, UserOperationLogModel } from '#/generated/zod/index.js';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const queryBooleanSchema = z.preprocess((val: unknown) => {
  if (val === undefined || val === '') return undefined;
  if (val === true || val === 'true') return true;
  if (val === false || val === 'false') return false;
  return val;
}, z.boolean().optional());

const dateRangeSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === '') return undefined;
    if (typeof val !== 'string') return val;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  },
  z.tuple([z.iso.datetime(), z.iso.datetime()]).optional(),
);

const LogSchema = UserOperationLogModel.pick({
  id: true,
  ip: true,
  location: true,
  userAgent: true,
  method: true,
  requestUrl: true,
  isSuccess: true,
  responseMsg: true,
  detailInfo: true,
  duration: true,
});
export class LogDto extends createZodDto(LogSchema) {}

const QueryLogParamsSchema = z.object({
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
    .max(100)
    .optional()
    .default(10)
    .meta({ description: '每页条数', example: 10 }),
  isSuccess: queryBooleanSchema.meta({ description: '状态' }),
  method: z.string().optional().meta({ description: '方法' }),
  requestUrl: z.string().optional().meta({ description: '请求URL' }),
  dateRange: dateRangeSchema.meta({ description: '日期范围' }),
});
export class QueryLogParams extends createZodDto(QueryLogParamsSchema) {}

const DeleteLogSchema = z.object({
  ids: z
    .array(z.number().int())
    .nonempty()
    .transform((val) => [...new Set(val)])
    .meta({ description: '日志ID数组', example: [1, 2, 3] }),
});
export class DeleteLogDto extends createZodDto(DeleteLogSchema) {}

const LogListResSchema = LogSchema.extend({
  createdAt: z.string(),
});
export class LogListResDto extends createZodDto(LogListResSchema) {}

const QueryAuditLogParamsSchema = z.object({
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
    .max(100)
    .optional()
    .default(10)
    .meta({ description: '每页条数', example: 10 }),
  action: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .meta({ description: '领域动作', example: 'user.update' }),
  resource: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .meta({ description: '聚合根类型', example: 'User' }),
  resourceId: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .meta({ description: '聚合根 ID' }),
  success: queryBooleanSchema.meta({
    description: '业务是否成功',
    example: true,
  }),
  dateRange: dateRangeSchema.meta({ description: '日期范围' }),
});
export class QueryAuditLogParams extends createZodDto(
  QueryAuditLogParamsSchema,
) {}

const AuditLogListResSchema = AuditLogModel.pick({
  id: true,
  userId: true,
  action: true,
  resource: true,
  resourceId: true,
  success: true,
  ip: true,
  location: true,
  metadata: true,
}).extend({
  createdAt: z.string(),
  user: z
    .object({
      username: z.string(),
      phone: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export class AuditLogListResDto extends createZodDto(AuditLogListResSchema) {}
