import { DepartmentSchema } from '#/generated/zod/schemas/models/Department.schema.js';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DepartmentIdSchema = z
  .string()
  .min(1)
  .meta({ description: '部门ID', example: 'department-1' });

const DepartmentBaseSchema = DepartmentSchema.pick({
  name: true,
  enabled: true,
  description: true,
  parentId: true,
}).extend({
  parentId: DepartmentIdSchema.nullish(),
});

const DepartmentDtoSchema = DepartmentBaseSchema.extend({
  id: DepartmentIdSchema,
});

const CreateDepartmentSchema = DepartmentBaseSchema;
export class CreateDepartmentDto extends createZodDto(CreateDepartmentSchema) {}

const UpdateDepartmentSchema = DepartmentDtoSchema.refine(
  (data) => data.parentId == null || data.id !== data.parentId,
  {
    message: '部门不能设置为自己的父部门',
    path: ['parentId'],
  },
);
export class UpdateDepartmentDto extends createZodDto(UpdateDepartmentSchema) {}

const FindDepartmentSchema = z.object({
  id: DepartmentIdSchema,
});

export class DeleteDepartmentDto extends createZodDto(FindDepartmentSchema) {}

// 排除updatedAt字段
const DepartmentTreeSchema = DepartmentSchema.omit({
  updatedAt: true,
}).extend({
  createdAt: z.iso.datetime(),
  get children() {
    return z.array(DepartmentTreeSchema).optional();
  },
});

export class DepartmentListResDto extends createZodDto(DepartmentTreeSchema) {}

const DepartmentLookupNodeSchema = z.object({
  id: DepartmentIdSchema,
  name: z.string(),
  parentId: DepartmentIdSchema.nullable(),
  enabled: z.boolean(),
  get children() {
    return z.array(DepartmentLookupNodeSchema).optional();
  },
});

export class DepartmentLookupResDto extends createZodDto(
  DepartmentLookupNodeSchema,
) {}
export type DepartmentLookupNode = z.infer<typeof DepartmentLookupNodeSchema>;

const DepartmentSeedSchema = DepartmentBaseSchema.omit({
  parentId: true,
}).extend({
  get children() {
    return z.array(DepartmentSeedSchema).optional();
  },
});

export class DepartmentSeedDto extends createZodDto(DepartmentSeedSchema) {}

const DepartmentSeedArraySchema = z.object({
  data: z.array(DepartmentSeedSchema),
});
export class DepartmentSeedArrayDto extends createZodDto(
  DepartmentSeedArraySchema,
) {}
