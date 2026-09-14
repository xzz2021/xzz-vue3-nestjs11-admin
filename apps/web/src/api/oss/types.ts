export interface OssConfig {
  putSimpleMaxBytes: number
  multipartPartBytes: number
  presignGetExpiresSec: number
  maxBatchKeys: number
}

export interface OssFolderItem {
  prefix: string
  name: string
}

export interface OssFileItem {
  key: string
  name: string
  size: number
  lastModified: string
  contentType?: string
}

export interface OssListResponse {
  prefix: string
  folders: OssFolderItem[]
  files: OssFileItem[]
  nextContinuationToken: string | null
  truncated: boolean
}

export interface OssPresignGetResponse {
  url: string
  expiresIn: number
  key: string
}

export interface OssPresignPutResponse {
  url: string
  method: 'PUT'
  headers: { 'Content-Type': string }
  key: string
  expiresIn: number
}

export interface OssMultipartInitResponse {
  uploadId: string
  key: string
  partSize: number
  partCount: number
}

export type OssListItem = ({ kind: 'folder' } & OssFolderItem) | ({ kind: 'file' } & OssFileItem)
