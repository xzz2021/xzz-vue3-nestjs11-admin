import request from '@/axios'
import type {
  RoleAuthorizationMenu,
  RoleDetail,
  RoleItem,
  RoleListParams,
  RoleSubmitPayload,
  RoleUpdatePayload,
} from './type'

export const getRoleListApi = (params?: RoleListParams): Promise<IResponse<{ list: RoleItem[]; total: number }>> => {
  return request.get({ url: 'role/getRoleList', params })
}

export const addRoleApi = (data: RoleSubmitPayload) => {
  return request.post({ url: 'role/add', data })
}

export const editRoleApi = (data: RoleUpdatePayload) => {
  return request.post({ url: 'role/update', data })
}

export const delRoleApi = (id: string) => {
  return request.delete({ url: 'role/' + id })
}

export const getRoleMenuAndPermissionApi = (id: string): Promise<IResponse<{ list: RoleAuthorizationMenu[] }>> => {
  return request.get({ url: 'role/getRoleMenuAndPer/' + id })
}

export const getRoleDetailApi = (id: string): Promise<IResponse<RoleDetail>> => {
  return request.get({ url: 'role/getRoleDetail/' + id })
}

export const generateRoleSeedApi = (data: RoleItem[]): Promise<IResponse<{ success: boolean }>> => {
  return request.post({ url: 'role/generateRoleSeed', data: { data } })
}
