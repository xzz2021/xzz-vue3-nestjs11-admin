import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { MessageType, NoticeLevel } from "./enums"
import { CompleteUser, RelatedUserModel } from "./index"

export const MessageModel = z.object({
  id: z.string(),
  /**
   * 派发批次 ID（Bull 任务幂等，防重试重复落库）
   */
  dispatchId: z.string(),
  type: z.nativeEnum(MessageType).meta({ description: '消息类型', example: 'SYSTEM' }),
  title: z.string().min(1).max(200).meta({ description: '消息标题', example: '系统通知' }),
  content: z.string().min(1).meta({ description: '消息内容', example: '服务已恢复' }),
  level: z.nativeEnum(NoticeLevel).optional().meta({ description: '级别', example: 'INFO' }),
  senderId: z.string().optional().meta({ description: '发送人 ID，系统/告警可为空', example: 'clxxx' }).nullish(),
  receiverId: z.string().meta({ description: '接收人 ID', example: 'clxxx' }),
  readAt: z.coerce.date().optional().meta({ description: '已读时间', example: '2026-01-01T12:00:00.000Z' }).nullish(),
  /**
   * 扩展信息：链接、来源模块等
   */
  meta: z.json(),
  createdAt: z.date(),
})

export class MessageDto extends createZodDto(MessageModel) {
}

export interface CompleteMessage extends z.infer<typeof MessageModel> {
  sender?: CompleteUser | null
  receiver: CompleteUser
}

/**
 * RelatedMessageModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedMessageModel: z.ZodType<CompleteMessage> = z.lazy(() => MessageModel.extend({
  sender: RelatedUserModel.nullish(),
  receiver: RelatedUserModel,
}))
