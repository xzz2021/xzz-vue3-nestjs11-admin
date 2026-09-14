import request, { type DownloadResponse } from '@/axios'
import type {
  OssConfig,
  OssListResponse,
  OssMultipartInitResponse,
  OssPresignGetResponse,
  OssPresignPutResponse
} from './types'

export const getOssConfigApi = () => {
  return request.get<OssConfig>({ url: 'oss/config', skipErrorToast: true })
}

export const getOssListApi = (params: { prefix?: string; continuationToken?: string }) => {
  return request.get<OssListResponse>({ url: 'oss/objects', params, skipErrorToast: true })
}

export const presignOssGetApi = (params: { key: string; disposition?: 'inline' | 'attachment' }) => {
  return request.get<OssPresignGetResponse>({ url: 'oss/objects/presign', params })
}

export const createOssFolderApi = (data: { prefix: string; name: string }) => {
  return request.post<{ key: string }>({ url: 'oss/folders', data })
}

export const presignOssPutApi = (data: {
  prefix: string
  filename: string
  contentType: string
  size: number
  overwrite?: boolean
}) => {
  return request.post<OssPresignPutResponse>({ url: 'oss/uploads/presign', data, skipErrorToast: true })
}

export const initiateOssMultipartApi = (data: {
  prefix: string
  filename: string
  contentType: string
  size: number
  overwrite?: boolean
}) => {
  return request.post<OssMultipartInitResponse>({
    url: 'oss/uploads/multipart',
    data,
    skipErrorToast: true
  })
}

export const abortOssMultipartApi = (data: { key: string; uploadId: string }) => {
  return request.post({ url: 'oss/uploads/multipart/abort', data, skipErrorToast: true })
}

export const copyOssObjectsApi = (data: {
  sources: { key: string; isFolder: boolean }[]
  destinationPrefix: string
  destinationName?: string
  overwrite?: boolean
}) => {
  return request.post({ url: 'oss/objects/copy', data, skipErrorToast: true })
}

export const deleteOssObjectsApi = (data: { keys: { key: string; isFolder: boolean }[] }) => {
  return request.delete({ url: 'oss/objects', data })
}

export const downloadOssFolderApi = (params: { prefix: string }): Promise<DownloadResponse> => {
  return request.download({ url: 'oss/folders/archive', params })
}
