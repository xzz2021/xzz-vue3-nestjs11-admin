export interface FileItem {
  id: number
  name: string
  mimeType: string
  path: string
  extension?: string | null
  size: number
  url: string
  sha256?: string | null
  createdAt: string
}

export interface FileListParams {
  name?: string
  mimeType?: string
  extension?: string
}

export type InitiateUploadResult =
  | { outcome: 'instant' | 'restored'; file: FileItem }
  | {
      outcome: 'resumed' | 'created'
      sessionId: string
      chunkSize: number
      totalChunks: number
      expiresAt: string
      uploadedChunks: number[]
    }

export interface UploadSessionStatus {
  sessionId: string
  status: string
  chunkSize: number
  totalChunks: number
  size: number
  originalName: string
  sha256: string
  expiresAt: string
  uploadedChunks: number[]
}
