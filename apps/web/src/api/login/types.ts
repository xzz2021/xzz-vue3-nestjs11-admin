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

export interface UserType {
  id: number
  username: string
  phone: string
  avatar: string
  roles: Array<{ id: number; name: string }>
  department: { id: number; name: string }
  createdAt: string
  email: string
}

export interface SmsLoginRes {
  userinfo: UserType
  access_token: string
}
