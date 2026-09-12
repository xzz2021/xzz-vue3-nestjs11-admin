import { DictionaryTypeModel } from '@/generated/zod/dictionarytype.js';
import z from 'zod';
import { createZodDto } from 'nestjs-zod';
import { DictionaryItemSchema } from './entry.dto.js';

const DictionaryItemResponseSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  label: z.string(),
  value: z.string(),
  sort: z.number(),
  enabled: z.boolean(),
  createdAt: z.coerce.string().optional(),
  updatedAt: z.coerce.string().optional(),
});
const DictionarySchema = z.object({
  name: z.string().min(1).max(50).meta({
    description: '字典名称',
    example: '状态',
  }),
  code: z.string().min(1).max(50).meta({
    description: '字典编码',
    example: 'AAA',
  }),
  description: z.string().optional().describe('字典描述'),
  status: z.boolean().optional().describe('字典状态'),
});

export class DictionaryDto extends createZodDto(DictionarySchema) {}

const UpsertDictionarySchema = z.intersection(
  z.object({
    id: z.string().min(1).optional().meta({
      description: '字典ID，更新时必传',
      example: '1',
    }),
  }),
  DictionarySchema,
);
export class UpsertDictionaryDto extends createZodDto(UpsertDictionarySchema) {}

const DeleteDictionarySchema = z.object({
  ids: z
    .array(z.string().min(1))
    .nonempty()
    .transform((val) => [...new Set(val)])
    .meta({
      description: '字典ID',
      example: ['1'],
    }),
});
export class DeleteDictionaryDto extends createZodDto(DeleteDictionarySchema) {}

const DictionaryListItemSchema = DictionaryTypeModel.omit({
  updatedAt: true,
}).extend({
  createdAt: z.coerce.string().optional(),
  items: z.array(DictionaryItemResponseSchema).optional(),
});

export class DictionaryListRes extends createZodDto(DictionaryListItemSchema) {}

const DictionarySeedSchema = z.intersection(
  DictionarySchema,
  z.object({
    entries: z.array(DictionaryItemSchema).optional(),
  }),
);
export class DictionarySeedDto extends createZodDto(DictionarySeedSchema) {}
const DictionarySeedArraySchema = z.object({
  data: z.array(DictionarySeedSchema).meta({
    description: '字典种子数据',
  }),
});
export class DictionarySeedArrayDto extends createZodDto(
  DictionarySeedArraySchema,
) {}
