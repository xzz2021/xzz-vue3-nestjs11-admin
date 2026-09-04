import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteUser, RelatedUserModel } from "./index"

export const AuditLogModel = z.object({
  id: z.string(),
  userId: z.string().nullish(),
  action: z.string().min(1).max(80).meta({ description: '领域动作', example: 'user.update' }),
  resource: z.string().min(1).max(100).meta({ description: '聚合根类型', example: 'User' }),
  resourceId: z.string().max(64).optional().meta({ description: '聚合根 ID', example: 'clxxx' }).nullish(),
  success: z.boolean().optional().meta({ description: '业务是否成功', example: true }),
  ip: z.string().max(45).optional().meta({ description: '操作 IP', example: '127.0.0.1' }).nullish(),
  location: z.string().max(100).optional().meta({ description: '操作地理位置', example: '中国 广东省 深圳市' }).nullish(),
  metadata: z.json(),
  createdAt: z.date(),
})

export class AuditLogDto extends createZodDto(AuditLogModel) {
}

export interface CompleteAuditLog extends z.infer<typeof AuditLogModel> {
  user?: CompleteUser | null
}

/**
 * RelatedAuditLogModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAuditLogModel: z.ZodType<CompleteAuditLog> = z.lazy(() => AuditLogModel.extend({
  user: RelatedUserModel.nullish(),
}))
