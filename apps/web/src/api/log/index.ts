import request from '@/axios'
import type { AuditLogItem, AuditLogListParams, LogItem, LogListParams } from './type'

export const getLogListApi = (params?: LogListParams): Promise<IResponse<{ list: LogItem[]; total: number }>> => {
  return request.get({ url: 'log/getUserOperationLogList', params })
}

export const delLogApi = (ids: number[]): Promise<IResponse<{ message: string }>> => {
  return request.delete({ url: 'log/deleteUserOperationLog', data: { ids } })
}

export const getAuditLogListApi = (
  params?: AuditLogListParams
): Promise<IResponse<{ list: AuditLogItem[]; total: number }>> => {
  return request.get({ url: 'log/getAuditLogList', params })
}
