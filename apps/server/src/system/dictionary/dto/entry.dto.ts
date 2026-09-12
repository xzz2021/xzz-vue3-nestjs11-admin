import z from "zod";
import { createZodDto } from "nestjs-zod";

export const DictionaryItemSchema = z.object({
  id: z.string().min(1).optional().describe("字典项ID, 更新时必传"),
  name: z.string().min(1).max(50).meta({
    description: "字典项名称",
    example: "字典项名称",
  }),
  code: z.string().min(1).max(50).meta({
    description: "字典项编码",
    example: "字典项编码",
  }),
  sort: z.number().int().min(0).optional().describe("字典项排序"),
  enabled: z.boolean().optional().describe("字典项状态"),
  description: z.string().optional().describe("字典项描述"),
});
export class DictionaryItemDto extends createZodDto(DictionaryItemSchema) {}

const UpsertItemSchema = z.intersection(
  z.object({
    dictionaryId: z.string().min(1).meta({
      description: "字典ID",
      example: "1",
    }),
  }),
  DictionaryItemSchema,
);
export class UpsertItemDto extends createZodDto(UpsertItemSchema) {}

const DeleteItemSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .nonempty()
    .meta({
      description: "字典项ID数组",
      example: ["1", "2", "3"],
    })
    .transform((val) => [...new Set(val)]),
});
export class DeleteItemDto extends createZodDto(DeleteItemSchema) {}
