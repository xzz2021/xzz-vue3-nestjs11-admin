import { UserSchema } from '#/generated/zod/schemas/models/User.schema.js';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const QueryUserParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .optional()
    .meta({ description: '部门id, 不传则查询所有用户' }),
  pageIndex: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .meta({ description: '页码', example: 1 }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .meta({ description: '每页条数', example: 10 }),
  username: z.string().optional().meta({ description: '用户名称' }),
  phone: z.string().optional().meta({ description: '用户手机号' }),
  enabled: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true',
    )
    .meta({ description: '用户状态' }),
});
export class QueryUserParams extends createZodDto(QueryUserParamsSchema) {}

const UserDtoSchema = UserSchema.pick({
  username: true,
  phone: true,
  avatar: true,
  enabled: true,
  email: true,
  nickname: true,
}).partial({
  avatar: true,
  enabled: true,
  email: true,
  nickname: true,
});
export class UserDto extends createZodDto(UserDtoSchema) {}

const UpdateUserSchema = UserDtoSchema.extend({
  id: z.string().min(1).meta({ description: '用户ID', example: '1' }),
  roles: z
    .array(z.string().min(1))
    .optional()
    .transform((val) => (Array.isArray(val) ? [...new Set(val)] : val))
    .meta({ description: '角色ID', example: ['1', '2'] }),
  department: z.string().min(1),
});
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

const CreateUserSchema = UpdateUserSchema.omit({ id: true }).extend({
  password: UserSchema.shape.password.meta({
    description: '初始密码',
    example: 'ChangeMe_Now!',
  }),
});
export class CreateUserDto extends createZodDto(CreateUserSchema) {}

const UpdatePersonalInfoSchema = UserDtoSchema.extend({
  id: z.string().min(1).meta({ description: '用户ID', example: '1' }),
});
export class UpdatePersonalInfo extends createZodDto(
  UpdatePersonalInfoSchema,
) {}

const UserListResSchema = z.object({
  total: z.number().meta({ description: '总条数', example: 10 }),
  list: z.array(UserDtoSchema).meta({ description: '列表数据' }),
});
export class UserListRes extends createZodDto(UserListResSchema) {}

const UserLookupSchema = z.object({
  id: z.string().min(1),
  username: z.string(),
  enabled: z.boolean(),
  departmentId: z.string().nullable(),
});
export class UserLookupItemDto extends createZodDto(UserLookupSchema) {}

const UserLookupListResSchema = z.object({
  total: z.number(),
  list: z.array(UserLookupSchema),
});
export class UserLookupListRes extends createZodDto(UserLookupListResSchema) {}

const UpdatePwdSchema = z.object({
  id: z.string().min(1).meta({ description: '用户ID', example: '1' }),
  password: UserSchema.shape.password.meta({
    description: '旧密码',
    example: 'OldPass_123!',
  }),
  newPassword: UserSchema.shape.password.meta({
    description: '新密码',
    example: 'NewPass_123!',
  }),
});
export class UpdatePwdDto extends createZodDto(UpdatePwdSchema) {}

const AdminUpdatePwdSchema = z.object({
  id: z.string().min(1).meta({ description: '用户ID', example: '1' }),
  password: UserSchema.shape.password.meta({
    description: '新密码',
    example: 'NewPass_123!',
  }),
});
export class AdminUpdatePwdDto extends createZodDto(AdminUpdatePwdSchema) {}

const BatchDeleteUserSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .nonempty()
    .transform((val) => [...new Set(val)])
    .meta({ description: '用户ID', example: ['1', '2'] }),
});
export class BatchDeleteUserDto extends createZodDto(BatchDeleteUserSchema) {}
