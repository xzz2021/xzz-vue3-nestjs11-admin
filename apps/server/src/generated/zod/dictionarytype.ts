import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteDictionaryItem, RelatedDictionaryItemModel } from "./index"

export const DictionaryTypeModel = z.object({
  id: z.string(),
  code: z.string().min(1).max(50).meta({ description: '字典编码，唯一标识', example: 'user_status' }),
  name: z.string().min(1).max(50).meta({ description: '字典名称', example: '用户状态' }),
  enabled: z.boolean().optional().meta({ description: '是否启用', example: true }),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class DictionaryTypeDto extends createZodDto(DictionaryTypeModel) {
}

export interface CompleteDictionaryType extends z.infer<typeof DictionaryTypeModel> {
  items: CompleteDictionaryItem[]
}

/**
 * RelatedDictionaryTypeModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedDictionaryTypeModel: z.ZodType<CompleteDictionaryType> = z.lazy(() => DictionaryTypeModel.extend({
  items: RelatedDictionaryItemModel.array(),
}))
