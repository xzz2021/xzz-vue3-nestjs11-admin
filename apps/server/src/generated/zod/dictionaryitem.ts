import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteDictionaryType, RelatedDictionaryTypeModel } from "./index"

export const DictionaryItemModel = z.object({
  id: z.string(),
  typeId: z.string(),
  label: z.string().min(1).max(50).meta({ description: '字典项标签', example: '启用' }),
  value: z.string().min(1).max(50).meta({ description: '字典项值', example: '1' }),
  sort: z.number().int().min(0).optional().meta({ description: '排序', example: 0 }),
  enabled: z.boolean().optional().meta({ description: '是否启用', example: true }),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class DictionaryItemDto extends createZodDto(DictionaryItemModel) {
}

export interface CompleteDictionaryItem extends z.infer<typeof DictionaryItemModel> {
  type: CompleteDictionaryType
}

/**
 * RelatedDictionaryItemModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedDictionaryItemModel: z.ZodType<CompleteDictionaryItem> = z.lazy(() => DictionaryItemModel.extend({
  type: RelatedDictionaryTypeModel,
}))
