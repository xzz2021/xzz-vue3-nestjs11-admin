import request from '@/axios'
import type { CreateMenuDto, CreatePermissionDto, MenuItem, UpdateMenuDto, UpdatePermissionDto } from './types'

export * from './types'

export const getMenuListApi = async (): Promise<
  IResponse<{
    list: MenuItem[]
    total?: number
  }>
> => {
  return request.get({ url: 'menu/getMenuList' })
}

export const addMenuApi = (data: CreateMenuDto): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: 'menu/add', data })
}

export const editMenuApi = (data: UpdateMenuDto): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: 'menu/update', data })
}

export const delMenuApi = (id: string): Promise<IResponse<{ id: string }>> => {
  return request.delete({ url: 'menu/' + id })
}

export const addPermissionApi = (data: CreatePermissionDto): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: 'permission/add', data })
}

export const updatePermissionApi = (data: UpdatePermissionDto): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: 'permission/update', data })
}

export const delPermissionApi = (id: string): Promise<IResponse<{ id: string }>> => {
  return request.delete({ url: 'permission/' + id })
}

export const sortMenuApi = (data: { id: string; sort: number }[]) => {
  return request.post({ url: 'menu/sort', data: { data } })
}

/** @deprecated 使用 addPermissionApi */
export const addPermission = addPermissionApi
/** @deprecated 使用 updatePermissionApi */
export const updatePermission = updatePermissionApi
/** @deprecated 使用 delPermissionApi */
export const delPermission = delPermissionApi
