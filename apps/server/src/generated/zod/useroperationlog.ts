import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteUser, RelatedUserModel } from "./index"

export const UserOperationLogModel = z.object({
  id: z.number().int(),
  ip: z.string().max(45).meta({ description: '请求 IP', example: '127.0.0.1' }),
  location: z.string().max(100).optional().meta({ description: '请求地理位置', example: '中国 广东省 深圳市' }).nullish(),
  userAgent: z.string().max(500).meta({ description: 'User-Agent', example: 'Mozilla/5.0' }),
  method: z.string().max(10).meta({ description: 'HTTP 方法', example: 'GET' }),
  requestUrl: z.string().max(255).meta({ description: '请求 URL', example: '/api/users' }),
  isSuccess: z.boolean().optional().meta({ description: '是否成功', example: true }),
  responseMsg: z.string().max(500).optional().meta({ description: '响应消息', example: 'OK' }).nullish(),
  detailInfo: z.json(),
  duration: z.coerce.number().int().min(0).meta({ description: '请求耗时（毫秒）', example: 120 }),
  userId: z.string().optional().meta({ description: '操作用户 ID', example: 'clxxx' }).nullish(),
  createdAt: z.date(),
})

export class UserOperationLogDto extends createZodDto(UserOperationLogModel) {
}

export interface CompleteUserOperationLog extends z.infer<typeof UserOperationLogModel> {
  user?: CompleteUser | null
}

/**
 * RelatedUserOperationLogModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedUserOperationLogModel: z.ZodType<CompleteUserOperationLog> = z.lazy(() => UserOperationLogModel.extend({
  user: RelatedUserModel.nullish(),
}))
