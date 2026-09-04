import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteUser, RelatedUserModel } from "./index"

export const UserSessionModel = z.object({
  id: z.string(),
  userId: z.string(),
  tokenHash: z.string().min(1).meta({ description: 'Token 哈希值', example: 'sha256...' }),
  ip: z.string().max(45).optional().meta({ description: '登录 IP', example: '127.0.0.1' }).nullish(),
  location: z.string().max(100).optional().meta({ description: '登录地理位置', example: '中国 广东省 深圳市' }).nullish(),
  userAgent: z.string().max(500).optional().meta({ description: 'User-Agent', example: 'Mozilla/5.0' }).nullish(),
  expiresAt: z.coerce.date().meta({ description: '过期时间', example: '2026-01-02T12:00:00.000Z' }),
  createdAt: z.date(),
})

export class UserSessionDto extends createZodDto(UserSessionModel) {
}

export interface CompleteUserSession extends z.infer<typeof UserSessionModel> {
  user: CompleteUser
}

/**
 * RelatedUserSessionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedUserSessionModel: z.ZodType<CompleteUserSession> = z.lazy(() => UserSessionModel.extend({
  user: RelatedUserModel,
}))
