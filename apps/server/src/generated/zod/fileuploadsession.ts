import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { FileUploadStatus } from "./enums"
import { CompleteUser, RelatedUserModel, CompleteFileUploadChunk, RelatedFileUploadChunkModel } from "./index"

export const FileUploadSessionModel = z.object({
  id: z.string(),
  sha256: z.string().length(64).regex(/^[0-9a-f]{64}$/).meta({ description: '申报 SHA-256', example: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }),
  size: z.coerce.bigint().meta({ description: '文件大小（字节）', example: '1024' }),
  originalName: z.string().min(1).max(255).meta({ description: '原始文件名', example: 'report.docx' }),
  mimeType: z.string().min(1).max(255).meta({ description: 'MIME 类型', example: 'application/pdf' }),
  chunkSize: z.coerce.number().int().positive().meta({ description: '分片大小', example: 5242880 }),
  totalChunks: z.coerce.number().int().positive().meta({ description: '分片总数', example: 12 }),
  status: z.nativeEnum(FileUploadStatus).meta({ description: '上传会话状态', example: 'UPLOADING' }),
  createdById: z.string(),
  tempDir: z.string().min(1).max(255).meta({ description: '临时目录相对路径', example: 'file/tmp/clxxx' }),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class FileUploadSessionDto extends createZodDto(FileUploadSessionModel) {
}

export interface CompleteFileUploadSession extends z.infer<typeof FileUploadSessionModel> {
  createdBy: CompleteUser
  chunks: CompleteFileUploadChunk[]
}

/**
 * RelatedFileUploadSessionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedFileUploadSessionModel: z.ZodType<CompleteFileUploadSession> = z.lazy(() => FileUploadSessionModel.extend({
  createdBy: RelatedUserModel,
  chunks: RelatedFileUploadChunkModel.array(),
}))
