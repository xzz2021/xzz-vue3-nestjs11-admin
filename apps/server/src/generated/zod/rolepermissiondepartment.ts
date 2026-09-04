import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteRolePermission, RelatedRolePermissionModel, CompleteDepartment, RelatedDepartmentModel } from "./index"

export const RolePermissionDepartmentModel = z.object({
  id: z.string(),
  rolePermissionId: z.string(),
  departmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class RolePermissionDepartmentDto extends createZodDto(RolePermissionDepartmentModel) {
}

export interface CompleteRolePermissionDepartment extends z.infer<typeof RolePermissionDepartmentModel> {
  rolePermission: CompleteRolePermission
  department: CompleteDepartment
}

/**
 * RelatedRolePermissionDepartmentModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRolePermissionDepartmentModel: z.ZodType<CompleteRolePermissionDepartment> = z.lazy(() => RolePermissionDepartmentModel.extend({
  rolePermission: RelatedRolePermissionModel,
  department: RelatedDepartmentModel,
}))
