import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const PrefixSchema = z.string().optional().default("");
const KeySchema = z.string().min(1);

export class ListObjectsQueryDto extends createZodDto(
  z.object({
    prefix: PrefixSchema,
    continuationToken: z.string().optional(),
  }),
) {}

export class PresignGetQueryDto extends createZodDto(
  z.object({
    key: KeySchema,
    disposition: z.enum(["inline", "attachment"]).optional().default("inline"),
  }),
) {}

export class CreateFolderDto extends createZodDto(
  z.object({
    prefix: PrefixSchema,
    name: z.string().min(1).max(255),
  }),
) {}

const UploadBodySchema = z.object({
  prefix: PrefixSchema,
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255).default("application/octet-stream"),
  size: z.number().int().nonnegative(),
  overwrite: z.boolean().optional(),
});
export class PresignPutDto extends createZodDto(UploadBodySchema) {}
export class InitiateMultipartDto extends createZodDto(UploadBodySchema) {}

export class MultipartPartsQueryDto extends createZodDto(
  z.object({
    key: KeySchema,
    uploadId: z.string().min(1),
  }),
) {}

export class PresignPartQueryDto extends createZodDto(
  z.object({
    key: KeySchema,
    uploadId: z.string().min(1),
    partNumber: z.coerce.number().int().min(1).max(10000),
  }),
) {}

export class CompleteMultipartDto extends createZodDto(
  z.object({
    key: KeySchema,
    uploadId: z.string().min(1),
    parts: z
      .array(
        z.object({
          partNumber: z.number().int().min(1),
          etag: z.string().min(1),
        }),
      )
      .min(1),
  }),
) {}

export class AbortMultipartDto extends createZodDto(
  z.object({
    key: KeySchema,
    uploadId: z.string().min(1),
  }),
) {}

export class CopyObjectsDto extends createZodDto(
  z.object({
    sources: z
      .array(
        z.object({
          key: KeySchema,
          isFolder: z.boolean(),
        }),
      )
      .min(1),
    destinationPrefix: PrefixSchema,
    destinationName: z.string().min(1).max(255).optional(),
    overwrite: z.boolean().optional(),
  }),
) {}

export class DeleteObjectsDto extends createZodDto(
  z.object({
    keys: z
      .array(
        z.object({
          key: KeySchema,
          isFolder: z.boolean(),
        }),
      )
      .min(1),
  }),
) {}

export class ArchiveQueryDto extends createZodDto(
  z.object({
    prefix: z.string().min(1),
  }),
) {}
