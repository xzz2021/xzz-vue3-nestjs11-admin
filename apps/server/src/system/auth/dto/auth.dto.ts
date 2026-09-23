import { UserSchema } from '#/generated/zod/schemas/models/User.schema.js';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod/dto';
import type { Request } from 'express';

const RegisterSchema = UserSchema.pick({
  username: true,
  password: true,
  phone: true,
  email: true,
  avatar: true,
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

const RegisterResSchema = UserSchema.omit({
  password: true,
}).extend({
  updatedAt: z.string(),
  createdAt: z.string(),
});
export class RegisterResDto extends createZodDto(RegisterResSchema) {}

const LoginInfoSchema = UserSchema.pick({
  phone: true,
  password: true,
});
export class LoginInfoDto extends createZodDto(LoginInfoSchema) {}

const ForceLogoutSchema = z.object({
  id: z.string().min(1),
});
export class ForceLogoutDto extends createZodDto(ForceLogoutSchema) {}

const GetSmsCodeSchema = z.object({
  phone: UserSchema.shape.phone,
  type: z.enum(['register', 'reset']).meta({
    description: '验证码用途',
    example: 'reset',
  }),
});
export class GetSmsCodeDto extends createZodDto(GetSmsCodeSchema) {}

const ForgotPasswordSchema = z.object({
  phone: UserSchema.shape.phone,
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, '验证码须为6位数字')
    .meta({ description: '短信验证码', example: '123456' }),
  password: UserSchema.shape.password.meta({
    description: '新密码',
    example: 'ChangeMe_Now!',
  }),
});
export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

/** JWT payload 挂到 req.user 上的结构 */
const JwtUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  phone: z.string().nullable().optional(),
  roles: z.array(z.unknown()), // 按你 signToken 实际结构再收紧
  // JWT 序列化后 Date 通常是字符串，用 coerce 更稳妥
  lockedUntil: z.string().nullable().optional(),
  jti: z.string(),
  iat: z.number(),
  exp: z.number(),
});
export type JwtUser = z.infer<typeof JwtUserSchema>;
/** 仅作类型用，不要 createZodDto */
export type JwtReqDto = Request & { user: JwtUser };
