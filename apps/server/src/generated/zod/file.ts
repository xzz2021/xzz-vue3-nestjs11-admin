import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"

export const FileModel = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(255).meta({ description: '文件名', example: 'avatar.png' }),
  mimeType: z.string().min(1).max(255).meta({ description: 'MIME 类型', example: 'image/png' }),
  path: z.string().min(1).max(255).meta({ description: '存储路径', example: '/uploads/2026/avatar.png' }),
  extension: z.string().max(20).optional().meta({ description: '文件扩展名', example: 'png' }).nullish(),
  size: z.coerce.bigint().meta({ description: '文件大小（字节）', example: '1024' }),
  url: z.string().url({ message: '文件 URL 格式不正确' }).max(255).meta({ description: '访问 URL', example: 'https://example.com/uploads/avatar.png' }),
  sha256: z.string().length(64).regex(/^[0-9a-f]{64}$/).optional().meta({ description: 'SHA-256', example: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }).nullish(),
  createdAt: z.date(),
  deletedAt: z.coerce.date().optional().meta({ description: '软删除时间，待异步清理磁盘', example: '2026-01-01T12:00:00.000Z' }).nullish(),
})

export class FileDto extends createZodDto(FileModel) {
}
