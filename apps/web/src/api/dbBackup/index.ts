import request, { type DownloadResponse } from '@/axios'

import type { DbBackupConfig, DbBackupJobListResponse, DbBackupJobQuery, UpdateDbBackupConfigDto } from './types'

export const getDbBackupConfigApi = (): Promise<IResponse<DbBackupConfig>> => {
  return request.get({ url: '/db-backup/config' })
}

export const updateDbBackupConfigApi = (data: UpdateDbBackupConfigDto): Promise<IResponse<DbBackupConfig>> => {
  return request.post({ url: '/db-backup/config', data })
}

export const runDbBackupApi = (): Promise<IResponse<{ id: string }>> => {
  return request.post({ url: '/db-backup/run' })
}

export const getDbBackupJobsApi = (params: DbBackupJobQuery): Promise<IResponse<DbBackupJobListResponse>> => {
  return request.get({ url: '/db-backup/jobs', params })
}

export const deleteDbBackupJobApi = (id: string): Promise<IResponse<any>> => {
  return request.delete({ url: `/db-backup/jobs/${id}` })
}

export const cleanupDbBackupJobsApi = (): Promise<IResponse<{ count: number }>> => {
  return request.post({ url: '/db-backup/cleanup' })
}

export const downloadDbBackupJobApi = (id: string): Promise<DownloadResponse> => {
  return request.download({
    url: `/db-backup/download/${id}`
  })
}
