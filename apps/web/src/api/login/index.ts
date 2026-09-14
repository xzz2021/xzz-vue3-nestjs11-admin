import request from '@/axios'
import type { SmsLoginRes, SmsLoginType, UserLoginType, UserRegisterType, UserType } from './types'

export const loginApi = (data: UserLoginType): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/rt/login', data, withCredentials: true })
}

export const smsLoginApi = (data: SmsLoginType): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/sms/login', data })
}

export const registerApi = (data: UserRegisterType): Promise<IResponse<UserType>> => {
  return request.post({ url: 'auth/register', data })
}

export const getRoleMenuApi = (): Promise<IResponse<{ list: AppCustomRouteRecordRaw[] }>> => {
  return request.get({ url: 'role/getRoleMenu' })
}

export const getSmsCode = (data: { phone: string; type: string }): Promise<IResponse<string>> => {
  return request.post({ url: 'auth/getSmsCode', data })
}

export const smsBind = (data: any): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/sms/bind', data })
}

export const wechatLogin = (code: string): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/wechat/login', data: { code } })
}

export const wechatBind = (data: any): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/wechat/bind', data })
}

export const loginOutApi = (): Promise<IResponse> => {
  return request.get({ url: 'auth/logout' })
}

export const getCaptchaApi = (): Promise<IResponse<{ svg: string }>> => {
  return request.get({ url: 'captcha/common', withCredentials: true })
}
