import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteUser, RelatedUserModel, CompleteRolePermissionDepartment, RelatedRolePermissionDepartmentModel, CompleteCustomer, RelatedCustomerModel } from "./index"

export const DepartmentModel = z.object({
  id: z.string(),
  parentId: z.string().nullish(),
  name: z.string().min(1).max(50).meta({ description: '部门名称', example: '研发部' }),
  path: z.string().max(512).meta({ description: '物化路径，用于树形查询', example: 'ROOT/child' }),
  sort: z.number().int().min(0).optional().meta({ description: '排序', example: 0 }),
  enabled: z.boolean().optional().meta({ description: '是否启用', example: true }),
  description: z.string().max(200).optional().meta({ description: '部门描述', example: '负责产品研发' }).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class DepartmentDto extends createZodDto(DepartmentModel) {
}

export interface CompleteDepartment extends z.infer<typeof DepartmentModel> {
  parent?: CompleteDepartment | null
  children: CompleteDepartment[]
  users: CompleteUser[]
  rolePermissionDepartments: CompleteRolePermissionDepartment[]
  customers: CompleteCustomer[]
}

/**
 * RelatedDepartmentModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedDepartmentModel: z.ZodType<CompleteDepartment> = z.lazy(() => DepartmentModel.extend({
  parent: RelatedDepartmentModel.nullish(),
  children: RelatedDepartmentModel.array(),
  users: RelatedUserModel.array(),
  rolePermissionDepartments: RelatedRolePermissionDepartmentModel.array(),
  customers: RelatedCustomerModel.array(),
}))
