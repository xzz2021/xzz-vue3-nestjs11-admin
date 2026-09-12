import { MessageType, NoticeLevel } from '@/generated/prisma/client.js';
import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

const ListQuerySchema = z.object({
  pageIndex: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  type: z.nativeEnum(MessageType).optional(),
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});
export class ListQueryDto extends createZodDto(ListQuerySchema) {}

const SendMailSchema = z.object({
  receiverIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  level: z.nativeEnum(NoticeLevel).optional(),
});
export class SendMailDto extends createZodDto(SendMailSchema) {}

const SendSystemSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  level: z.nativeEnum(NoticeLevel).optional(),
});
export class SendSystemDto extends createZodDto(SendSystemSchema) {}

const IdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export class IdsDto extends createZodDto(IdsSchema) {}

const ReceiversQuerySchema = z.object({
  keyword: z.string().max(50).optional(),
});
export class ReceiversQueryDto extends createZodDto(ReceiversQuerySchema) {}
