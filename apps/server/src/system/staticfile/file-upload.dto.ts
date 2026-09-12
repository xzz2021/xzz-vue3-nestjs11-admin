import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const InitiateUploadSchema = z.object({
  sha256: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i)
    .meta({
      description: "文件 SHA-256",
      example:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
  size: z
    .number()
    .int()
    .positive()
    .meta({ description: "文件大小（字节）", example: 1024 }),
  originalName: z
    .string()
    .min(1)
    .max(255)
    .meta({ description: "原始文件名", example: "report.docx" }),
  mimeType: z
    .string()
    .max(255)
    .default("application/octet-stream")
    .meta({ description: "MIME 类型", example: "application/pdf" }),
});
export class InitiateUploadDto extends createZodDto(InitiateUploadSchema) {}
