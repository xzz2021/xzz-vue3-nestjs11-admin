import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteUser, RelatedUserModel, CompleteRole, RelatedRoleModel } from "./index"

export const UserRoleModel = z.object({
  userId: z.string(),
  roleId: z.string(),
  assignedById: z.string().optional().meta({ description: '分配人用户 ID', example: 'clxxx' }).nullish(),
  assignedAt: z.coerce.date().optional().meta({ description: '分配时间', example: '2026-01-01T12:00:00.000Z' }).nullish(),
  createdAt: z.date(),
})

export class UserRoleDto extends createZodDto(UserRoleModel) {
}

export interface CompleteUserRole extends z.infer<typeof UserRoleModel> {
  user: CompleteUser
  role: CompleteRole
  assignedBy?: CompleteUser | null
}

/**
 * RelatedUserRoleModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedUserRoleModel: z.ZodType<CompleteUserRole> = z.lazy(() => UserRoleModel.extend({
  user: RelatedUserModel,
  role: RelatedRoleModel,
  assignedBy: RelatedUserModel.nullish(),
}))
