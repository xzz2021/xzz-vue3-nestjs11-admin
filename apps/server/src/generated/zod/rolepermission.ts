import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { DataScope } from "./enums"
import { CompleteRole, RelatedRoleModel, CompletePermission, RelatedPermissionModel, CompleteRolePermissionDepartment, RelatedRolePermissionDepartmentModel } from "./index"

export const RolePermissionModel = z.object({
  id: z.string(),
  roleId: z.string(),
  permissionId: z.string(),
  dataScope: z.enum(DataScope).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class RolePermissionDto extends createZodDto(RolePermissionModel) {
}

export interface CompleteRolePermission extends z.infer<typeof RolePermissionModel> {
  role: CompleteRole
  permission: CompletePermission
  customDepartments: CompleteRolePermissionDepartment[]
}

/**
 * RelatedRolePermissionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRolePermissionModel: z.ZodType<CompleteRolePermission> = z.lazy(() => RolePermissionModel.extend({
  role: RelatedRoleModel,
  permission: RelatedPermissionModel,
  customDepartments: RelatedRolePermissionDepartmentModel.array(),
}))
