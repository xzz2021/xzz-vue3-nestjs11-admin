import request from '@/axios'
import type {
  CreateUserPayload,
  PersonalUserDetail,
  QueryUserParams,
  ResetPasswordPayload,
  UpdatePasswordPayload,
  UpdatePersonalInfoPayload,
  UpdateUserPayload,
  UserItem
} from './types'

export * from './types'

export const getUserByDepartmentIdApi = (
  params: QueryUserParams
): Promise<IResponse<{ list: UserItem[]; total: number }>> => {
  return request.get({ url: 'user/listByDepartmentId', params })
}

export interface UserLookupItem {
  id: string
  username: string
  enabled: boolean
  departmentId: string | null
}

export const getUserLookupApi = (
  params: QueryUserParams
): Promise<IResponse<{ list: UserLookupItem[]; total: number }>> => {
  return request.get({ url: 'user/lookup', params })
}

export const addUserApi = (data: CreateUserPayload) => {
  return request.post({ url: 'user/add', data })
}

export const updateUserApi = (data: UpdateUserPayload): Promise<IResponse> => {
  return request.post({ url: 'user/update', data })
}

export const deleteUserApi = (ids: string[]): Promise<IResponse> => {
  return request.delete({ url: 'user/delete', data: { ids } })
}

export const resetPasswordApi = (data: ResetPasswordPayload): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: 'user/resetPassword', data })
}

export const getPersonByIdApi = (): Promise<IResponse<{ userinfo: PersonalUserDetail }>> => {
  return request.get({ url: 'user/detailInfo' })
}

export const updatePersonApi = (data: UpdatePersonalInfoPayload) => {
  return request.post({ url: 'user/updatePersonalInfo', data })
}

export const updatePasswordApi = (data: UpdatePasswordPayload) => {
  return request.post({ url: 'user/updatePassword', data })
}

export const uploadAvatarApi = (data: FormData): Promise<IResponse<{ filePath: string }>> => {
  return request.post({
    url: 'user/upload/avatar',
    data,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
