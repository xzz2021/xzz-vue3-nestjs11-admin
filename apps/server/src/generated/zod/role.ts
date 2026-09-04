import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteUserRole, RelatedUserRoleModel, CompleteRoleMenu, RelatedRoleMenuModel, CompleteRolePermission, RelatedRolePermissionModel, CompleteUser, RelatedUserModel } from "./index"

export const RoleModel = z.object({
  id: z.string(),
  code: z.string().min(1).max(50).meta({ description: '角色编码，唯一标识', example: 'SUPER_ADMIN' }),
  name: z.string().min(1).max(50).meta({ description: '角色名称', example: '超级管理员' }),
  description: z.string().max(200).optional().meta({ description: '角色描述', example: '拥有全部后台权限' }).nullish(),
  sort: z.number().int().min(0).optional().meta({ description: '排序', example: 0 }),
  enabled: z.boolean().optional().meta({ description: '是否启用', example: true }),
  isSystem: z.boolean().optional().meta({ description: '是否系统角色，系统角色不可删除', example: false }),
  createdById: z.string().optional().meta({ description: '创建人用户 ID', example: 'clxxx' }).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class RoleDto extends createZodDto(RoleModel) {
}

export interface CompleteRole extends z.infer<typeof RoleModel> {
  users: CompleteUserRole[]
  menus: CompleteRoleMenu[]
  permissions: CompleteRolePermission[]
  createdBy?: CompleteUser | null
}

/**
 * RelatedRoleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRoleModel: z.ZodType<CompleteRole> = z.lazy(() => RoleModel.extend({
  users: RelatedUserRoleModel.array(),
  menus: RelatedRoleMenuModel.array(),
  permissions: RelatedRolePermissionModel.array(),
  createdBy: RelatedUserModel.nullish(),
}))
