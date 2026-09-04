import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CustomerStatus } from "./enums"
import { CompleteUser, RelatedUserModel, CompleteDepartment, RelatedDepartmentModel } from "./index"

export const CustomerModel = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullish(),
  remark: z.string().nullish(),
  status: z.enum(CustomerStatus),
  dealAmount: z.number(),
  internalCost: z.number(),
  confidential: z.boolean(),
  ownerId: z.string(),
  departmentId: z.string(),
  createdById: z.string(),
  version: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class CustomerDto extends createZodDto(CustomerModel) {
}

export interface CompleteCustomer extends z.infer<typeof CustomerModel> {
  owner: CompleteUser
  department: CompleteDepartment
  createdBy: CompleteUser
}

/**
 * RelatedCustomerModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedCustomerModel: z.ZodType<CompleteCustomer> = z.lazy(() => CustomerModel.extend({
  owner: RelatedUserModel,
  department: RelatedDepartmentModel,
  createdBy: RelatedUserModel,
}))
