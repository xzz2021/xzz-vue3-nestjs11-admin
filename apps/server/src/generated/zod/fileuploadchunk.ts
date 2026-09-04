import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteFileUploadSession, RelatedFileUploadSessionModel } from "./index"

export const FileUploadChunkModel = z.object({
  id: z.number().int(),
  sessionId: z.string(),
  chunkIndex: z.number().int(),
  size: z.number().int(),
})

export class FileUploadChunkDto extends createZodDto(FileUploadChunkModel) {
}

export interface CompleteFileUploadChunk extends z.infer<typeof FileUploadChunkModel> {
  session: CompleteFileUploadSession
}

/**
 * RelatedFileUploadChunkModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedFileUploadChunkModel: z.ZodType<CompleteFileUploadChunk> = z.lazy(() => FileUploadChunkModel.extend({
  session: RelatedFileUploadSessionModel,
}))
