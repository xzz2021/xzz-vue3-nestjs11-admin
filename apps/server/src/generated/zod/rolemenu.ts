import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteRole, RelatedRoleModel, CompleteMenu, RelatedMenuModel } from "./index"

export const RoleMenuModel = z.object({
  roleId: z.string(),
  menuId: z.string(),
})

export class RoleMenuDto extends createZodDto(RoleMenuModel) {
}

export interface CompleteRoleMenu extends z.infer<typeof RoleMenuModel> {
  role: CompleteRole
  menu: CompleteMenu
}

/**
 * RelatedRoleMenuModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRoleMenuModel: z.ZodType<CompleteRoleMenu> = z.lazy(() => RoleMenuModel.extend({
  role: RelatedRoleModel,
  menu: RelatedMenuModel,
}))
