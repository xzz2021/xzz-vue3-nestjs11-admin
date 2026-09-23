import { FileSchema } from '#/generated/zod/schemas/models/File.schema.js';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const DeleteFileSchema = z.object({
  ids: z
    .array(z.number().int())
    .nonempty()
    .transform((val) => [...new Set(val)])
    .meta({ description: '文件ID数组', example: [1, 2, 3] }),
});
export class DeleteFileDto extends createZodDto(DeleteFileSchema) {}

const UploadFileSchema = FileSchema.omit({
  id: true,
  createdAt: true,
  deletedAt: true,
  sha256: true,
}).extend({
  name: z
    .string()
    .nonempty()
    .meta({ description: '文件名称', example: '文件名称' }),
  mimeType: z
    .string()
    .nonempty()
    .meta({ description: '文件MIME类型', example: 'application/pdf' }),
  path: z
    .string()
    .nonempty()
    .meta({ description: '文件路径', example: '文件路径' }),
  size: z
    .number()
    .int()
    .min(0)
    .meta({ description: '文件大小', example: 1000 }),
  url: z
    .string()
    .nonempty()
    .meta({ description: '文件URL', example: '文件URL' }),
  extension: z
    .string()
    .nonempty()
    .meta({ description: '文件扩展名', example: 'pdf' }),
});
export class UploadFileDto extends createZodDto(UploadFileSchema) {}

const FileListResSchema = UploadFileSchema.extend({
  createdAt: z.string(),
  sha256: z.string().length(64).optional().nullable(),
});
export class FileListResDto extends createZodDto(FileListResSchema) {}
