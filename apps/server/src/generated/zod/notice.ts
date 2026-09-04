import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { NoticeLevel } from "./enums"

export const NoticeModel = z.object({
  id: z.string(),
  title: z.string().min(1).max(100).meta({ description: '公告标题', example: '系统维护通知' }),
  content: z.string().min(1).meta({ description: '公告内容', example: '系统将于今晚 22:00 维护' }),
  level: z.nativeEnum(NoticeLevel).optional().meta({ description: '公告级别', example: 'INFO' }),
  published: z.boolean().optional().meta({ description: '是否已发布', example: false }),
  startsAt: z.coerce.date().optional().meta({ description: '生效开始时间', example: '2026-01-01T00:00:00.000Z' }).nullish(),
  endsAt: z.coerce.date().optional().meta({ description: '生效结束时间', example: '2026-12-31T23:59:59.000Z' }).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class NoticeDto extends createZodDto(NoticeModel) {
}
