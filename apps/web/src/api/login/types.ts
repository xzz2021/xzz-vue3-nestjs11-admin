import type { UserItem } from '@/api/user/types'

export interface UserLoginType {
  username?: string
  password: string
  phone: string
}

export interface UserLoginFormType extends UserLoginType {
  captchaText: string
}

/** 记住我仅持久化账号标识，禁止包含密码 */
export interface UserLoginInfoType {
  username?: string
  phone: string
}

export interface SmsLoginType {
  phone: string
  code: string
}

export type UserRegisterType = UserLoginType & SmsLoginType

export interface RegisterResult {
  res?: { id: string }
}

export interface WechatProfile {
  username?: string
  avatar?: string
}

export interface WechatBindPayload extends UserRegisterType, WechatProfile {}

export type LoginUser = UserItem

export interface SmsLoginRes {
  userinfo: LoginUser
  access_token: string
}
