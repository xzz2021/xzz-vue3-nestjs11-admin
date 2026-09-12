import { UserModel } from '#/generated/zod/index.js';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod/dto';
import type { Request } from 'express';

const RegisterSchema = UserModel.pick({
  username: true,
  password: true,
  phone: true,
  email: true,
  avatar: true,
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

const RegisterResSchema = UserModel.omit({
  password: true,
}).extend({
  updatedAt: z.string(),
  createdAt: z.string(),
});
export class RegisterResDto extends createZodDto(RegisterResSchema) {}

const LoginInfoSchema = UserModel.pick({
  phone: true,
  password: true,
});
export class LoginInfoDto extends createZodDto(LoginInfoSchema) {}

const ForceLogoutSchema = z.object({
  id: z.string().min(1),
});
export class ForceLogoutDto extends createZodDto(ForceLogoutSchema) {}

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
