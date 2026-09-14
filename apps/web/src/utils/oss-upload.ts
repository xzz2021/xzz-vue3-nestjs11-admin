import { presignOssPutApi, abortOssMultipartApi } from '@/api/oss'
import type { OssConfig } from '@/api/oss/types'
import { ChunkUploader, OssConflictError } from '@/utils/chunk'
import { useUserStoreWithOut } from '@/store/modules/user'

export { OssConflictError }

const isConflict = (error: unknown): boolean => {
  if (error instanceof OssConflictError) return true
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status === 409
  }
  return false
}

export interface UploadOssFileOptions {
  file: File
  prefix: string
  filename: string
  overwrite?: boolean
  config: OssConfig
  onProgress?: (uploadedBytes: number, totalBytes: number) => void
  signal?: AbortSignal
}

export const uploadOssFile = async (options: UploadOssFileOptions): Promise<void> => {
  const { file, prefix, filename, overwrite, config, onProgress, signal } = options
  const contentType = file.type || 'application/octet-stream'

  if (file.size < config.putSimpleMaxBytes) {
    try {
      const res = await presignOssPutApi({
        prefix,
        filename,
        contentType,
        size: file.size,
        overwrite
      })
      const put = await fetch(res.data.url, {
        method: 'PUT',
        headers: res.data.headers,
        body: file,
        signal
      })
      if (!put.ok) throw new Error(`put failed: ${put.status}`)
      onProgress?.(file.size, file.size)
      return
    } catch (error) {
      if (isConflict(error)) throw new OssConflictError()
      throw error
    }
  }

  const userStore = useUserStoreWithOut()
  const uploader = new ChunkUploader(file, {
    prefix,
    filename,
    overwrite,
    apiBase: String(import.meta.env.VITE_API_BASE_PATH || ''),
    pathPrefix: 'oss/uploads',
    signal,
    headers: userStore.getToken
      ? { [userStore.getTokenKey || 'Authorization']: `Bearer ${userStore.getToken}` }
      : undefined,
    onProgress: (progress) => onProgress?.(progress.uploadedBytes, progress.totalBytes)
  })
  try {
    await uploader.uploadAll()
  } catch (error) {
    if (signal?.aborted) {
      await abortOssMultipartApi({ key: uploader.key, uploadId: uploader.uploadId || '' }).catch(() => undefined)
    }
    if (isConflict(error)) throw new OssConflictError()
    throw error
  }
}
