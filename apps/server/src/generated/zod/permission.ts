import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { PermissionType } from "./enums"
import { CompleteMenu, RelatedMenuModel, CompleteRolePermission, RelatedRolePermissionModel } from "./index"

export const PermissionModel = z.object({
  id: z.string().meta({ description: '所属菜单 ID', example: 'clxxx' }),
  name: z.string().min(1).max(50).meta({ description: '权限名称', example: '用户列表' }),
  code: z.string().min(1).max(100).meta({ description: '权限编码，唯一标识', example: 'system:user:list' }),
  resource: z.string().nullish(),
  action: z.string().nullish(),
  scopeEnabled: z.boolean(),
  type: z.nativeEnum(PermissionType).meta({ description: '权限类型', example: 'BUTTON' }),
  sort: z.number().int().min(0).optional().meta({ description: '排序', example: 0 }),
  enabled: z.boolean().optional().meta({ description: '是否启用', example: true }),
  menuId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class PermissionDto extends createZodDto(PermissionModel) {
}

export interface CompletePermission extends z.infer<typeof PermissionModel> {
  menu: CompleteMenu
  roles: CompleteRolePermission[]
}

/**
 * RelatedPermissionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedPermissionModel: z.ZodType<CompletePermission> = z.lazy(() => PermissionModel.extend({
  menu: RelatedMenuModel,
  roles: RelatedRolePermissionModel.array(),
}))
