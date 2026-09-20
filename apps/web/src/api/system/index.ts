import request from '@/axios'
import type { QueryUserParams } from '@/api/user/types'
import type { ServerInfoResponse, UserListResponse } from './types'

//  此处后端合并了处理分页查询和 带id过滤的分页查询
export const getUserListApi = (params: QueryUserParams): Promise<IResponse<UserListResponse>> => {
  return request.get({ url: 'user/list', params })
}

export const forceLogoutApi = (userId: string): Promise<IResponse> => {
  return request.post({ url: '/online/kickUser', data: { userId } })
}

export const unlockApi = (id: number): Promise<IResponse> => {
  return request.post({ url: 'auth/unlock', data: { id } })
}

export const getOnlineUserListApi = (params?: { keyword?: string }): Promise<IResponse<UserListResponse>> => {
  return request.get({ url: '/online/list', params })
}

export const getServerInfoApi = (): Promise<IResponse<ServerInfoResponse>> => {
  return request.get({ url: 'utils/serverInfo' })
}
