import request from '@/axios'
import type { CreateDepartmentDto, DepartmentItem, UpdateDepartmentDto } from './types'

export * from './types'

export const getDepartmentListApi = (): Promise<IResponse<{ list: DepartmentItem[]; total: number }>> => {
  return request.get({ url: 'department/list' })
}

export const getDepartmentLookupApi = (): Promise<IResponse<{ list: DepartmentItem[]; total: number }>> => {
  return request.get({ url: 'department/lookup' })
}

export const addDepartmentApi = (data: CreateDepartmentDto): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: 'department/add', data })
}

export const editDepartmentApi = (data: UpdateDepartmentDto): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: 'department/update', data })
}

export const delDepartmentApi = (id: string): Promise<IResponse> => {
  return request.delete({ url: 'department/delete', data: { id } })
}

/** @deprecated 使用 delDepartmentApi */
export const deleteDepartmentApi = (id: string | string[]) => {
  const targetId = Array.isArray(id) ? id[0] : id
  return delDepartmentApi(String(targetId))
}

export const saveDepartmentApi = (data: Recordable) => {
  const payload = {
    name: data.name,
    parentId: data.parentId || null,
    enabled: data.enabled ?? true,
    description: data.description || undefined
  }

  if (data.id) {
    return editDepartmentApi({ ...payload, id: data.id })
  }
  return addDepartmentApi(payload)
}

export const generateDepartmentSeedApi = (data: CreateDepartmentDto[]) => {
  return request.post({ url: 'department/generateDepartmentSeed', data: { data } })
}
