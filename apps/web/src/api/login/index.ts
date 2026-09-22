import axios from 'axios'
import request from '@/axios'
import type {
  ForgotPasswordPayload,
  RegisterResult,
  SmsLoginRes,
  SmsLoginType,
  UserLoginType,
  UserRegisterType,
  WechatBindPayload
} from './types'

const sessionClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_PATH,
  withCredentials: true
})

export const loginApi = (data: UserLoginType): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/rt/login', data, withCredentials: true })
}

export const smsLoginApi = (data: SmsLoginType): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/sms/login', data })
}

export const registerApi = (data: UserRegisterType): Promise<IResponse<RegisterResult>> => {
  return request.post({ url: 'auth/register', data })
}

export const getRoleMenuApi = (): Promise<IResponse<{ list: AppCustomRouteRecordRaw[] }>> => {
  return request.get({ url: 'role/getRoleMenu' })
}

export const getSmsCode = (data: { phone: string; type: string }): Promise<IResponse<string>> => {
  return request.post({ url: 'auth/getSmsCode', data })
}

export const forgotPasswordApi = (
  data: ForgotPasswordPayload
): Promise<IResponse<{ message?: string }>> => {
  return request.post({ url: 'auth/forgot-password', data })
}

export const smsBind = (data: SmsLoginType): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/sms/bind', data })
}

export const wechatLogin = (code: string): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/wechat/login', data: { code } })
}

export const wechatBind = (data: WechatBindPayload): Promise<IResponse<SmsLoginRes>> => {
  return request.post({ url: 'auth/wechat/bind', data })
}

export const loginOutApi = (id: string, token: string): Promise<IResponse> => {
  return sessionClient
    .post<IResponse>('/auth/logout', { id }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    .then((response) => response.data)
}

export const getCaptchaApi = (): Promise<IResponse<{ svg: string }>> => {
  return request.get({ url: 'captcha/common', withCredentials: true })
}
