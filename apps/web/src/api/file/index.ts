import request from '@/axios'
import type { AxiosProgressEvent } from 'axios'
import type { FileItem, FileListParams, InitiateUploadResult, UploadSessionStatus } from './types'

export const uploadFileApi = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post({
    url: 'staticfile/upload',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const getFileListApi = (params?: FileListParams) => {
  return request.get({ url: 'staticfile/list', params })
}

export const deleteFileApi = (ids: number[]) => {
  return request.delete({ url: 'staticfile/delete', data: { ids } })
}

export const initiateUploadApi = (payload: {
  sha256: string
  size: number
  originalName: string
  mimeType: string
}) => {
  return request.post<InitiateUploadResult>({
    url: 'staticfile/uploads/initiate',
    data: payload
  })
}

export const getUploadSessionApi = (sessionId: string) => {
  return request.get<UploadSessionStatus>({
    url: `staticfile/uploads/${sessionId}`
  })
}

export const uploadChunkApi = (
  sessionId: string,
  index: number,
  chunk: Blob,
  onUploadProgress?: (event: AxiosProgressEvent) => void
) => {
  const formData = new FormData()
  formData.append('chunk', chunk)
  return request.put({
    url: `staticfile/uploads/${sessionId}/chunks/${index}`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
    onUploadProgress
  })
}

export const completeUploadApi = (sessionId: string) => {
  return request.post<{ file: FileItem }>({
    url: `staticfile/uploads/${sessionId}/complete`,
    timeout: 120_000
  })
}

export const abortUploadApi = (sessionId: string) => {
  return request.post({
    url: `staticfile/uploads/${sessionId}/abort`
  })
}
