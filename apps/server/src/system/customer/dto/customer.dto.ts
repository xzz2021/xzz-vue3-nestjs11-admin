import { CustomerStatus } from '#/generated/prisma/enums.js';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const id = z.string().trim().min(1).max(64);
const nullableText = (max: number) => z.string().max(max).nullable().optional();

const DecimalInputSchema = z
  .union([z.string().trim().min(1), z.number().finite()])
  .transform((value) => String(value))
  .refine((value) => /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value), {
    message: '金额必须是非负且不超过 Decimal(18,2) 的安全数值',
  });

const MutableCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    phone: nullableText(30),
    remark: nullableText(2000),
    status: z.enum(CustomerStatus).optional(),
    dealAmount: DecimalInputSchema.optional(),
    internalCost: DecimalInputSchema.optional(),
    confidential: z.boolean().optional(),
    ownerId: id.optional(),
    departmentId: id.optional(),
  })
  .strict();

export const CreateCustomerSchema = MutableCustomerSchema.extend({
  name: z.string().trim().min(1).max(100),
});
export class CreateCustomerDto extends createZodDto(CreateCustomerSchema) {}

export const UpdateCustomerSchema = MutableCustomerSchema.extend({
  id,
  version: z.coerce.number().int().min(0),
}).refine(
  (data) => Object.keys(data).some((key) => key !== 'id' && key !== 'version'),
  {
    message: '至少提供一个待更新字段',
  },
);
export class UpdateCustomerDto extends createZodDto(UpdateCustomerSchema) {}

export const DeleteCustomerSchema = z
  .object({
    ids: z
      .array(id)
      .min(1)
      .max(100)
      .transform((values) => [...new Set(values)]),
  })
  .strict();
export class DeleteCustomerDto extends createZodDto(DeleteCustomerSchema) {}

export const QueryCustomerSchema = z
  .object({
    pageIndex: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    keyword: z.string().trim().max(100).optional(),
    status: z.enum(CustomerStatus).optional(),
    departmentId: id.optional(),
  })
  .strict();
export class QueryCustomerDto extends createZodDto(QueryCustomerSchema) {}

export const ExportCustomerSchema = z
  .object({
    keyword: z.string().trim().max(100).optional(),
    status: z.enum(CustomerStatus).optional(),
    departmentId: id.optional(),
  })
  .strict();
export class ExportCustomerDto extends createZodDto(ExportCustomerSchema) {}

const CustomerResponseSchema = z
  .object({
    id,
    name: z.string(),
    phone: z.string().nullable(),
    remark: z.string().nullable(),
    status: z.enum(CustomerStatus),
    dealAmount: z.string(),
    internalCost: z.string().optional(),
    confidential: z.boolean(),
    ownerId: id,
    departmentId: id,
    createdById: id,
    version: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    capabilities: z.array(z.enum(['update', 'delete', 'detail'])),
  })
  .strict();

export class CustomerResponseDto extends createZodDto(CustomerResponseSchema) {}
const CustomerListResponseSchema = z.object({
  list: z.array(CustomerResponseSchema),
  total: z.number().int().nonnegative(),
  pageIndex: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export class CustomerListResponseDto extends createZodDto(
  CustomerListResponseSchema,
) {}

const successEnvelope = <T extends z.ZodType>(data: T) =>
  z
    .object({
      data,
      code: z.number(),
      message: z.string(),
      timestamp: z.string(),
    })
    .strict();

export const CustomerListSuccessEnvelopeSchema = successEnvelope(
  CustomerListResponseSchema,
);
export const CustomerDetailSuccessEnvelopeSchema = successEnvelope(
  CustomerResponseSchema,
);
export const CustomerMutationSuccessEnvelopeSchema = successEnvelope(
  z.object({ id }),
);
export const CustomerDeleteSuccessEnvelopeSchema = successEnvelope(
  z.object({ count: z.number().int().positive() }),
);

export class CustomerListSuccessEnvelopeDto extends createZodDto(
  CustomerListSuccessEnvelopeSchema,
) {}
export class CustomerDetailSuccessEnvelopeDto extends createZodDto(
  CustomerDetailSuccessEnvelopeSchema,
) {}
export class CustomerMutationSuccessEnvelopeDto extends createZodDto(
  CustomerMutationSuccessEnvelopeSchema,
) {}
export class CustomerDeleteSuccessEnvelopeDto extends createZodDto(
  CustomerDeleteSuccessEnvelopeSchema,
) {}
