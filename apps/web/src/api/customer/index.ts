import request, { type DownloadResponse } from '@/axios'
import type {
  CreateCustomerPayload,
  CustomerItem,
  CustomerListResult,
  ExportCustomerParams,
  QueryCustomerParams,
  UpdateCustomerPayload,
} from './type'

export * from './type'

export const getCustomerListApi = (params: QueryCustomerParams): Promise<IResponse<CustomerListResult>> => {
  return request.get({ url: '/customer/list', params })
}

export const getCustomerDetailApi = (id: string): Promise<IResponse<CustomerItem>> => {
  return request.get({ url: `/customer/detail/${id}` })
}

export const addCustomerApi = (data: CreateCustomerPayload): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: '/customer/add', data })
}

export const updateCustomerApi = (data: UpdateCustomerPayload): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: '/customer/update', data })
}

export const deleteCustomerApi = (ids: string[]): Promise<IResponse<{ count: number }>> => {
  return request.delete({ url: '/customer/delete', data: { ids } })
}

export const exportCustomerApi = (params: ExportCustomerParams): Promise<DownloadResponse> => {
  return request.download({ url: '/customer/export', params })
}
