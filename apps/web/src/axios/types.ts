import type { AxiosRequestConfig, AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios'

export type CancellablePromise<T> = Promise<T> & { cancel: () => void }

export interface DownloadResponse {
  data: Blob
  headers: RawAxiosResponseHeaders | AxiosResponseHeaders
}

export interface RequestConfig extends AxiosRequestConfig {
  requestId?: string
  _retry?: boolean
  /** refresh 因基础设施故障失败（非鉴权失败） */
  _refreshInfraError?: boolean
}

declare module 'axios' {
  interface AxiosRequestConfig {
    requestId?: string
    _retry?: boolean
    _refreshInfraError?: boolean
    skipErrorToast?: boolean
  }

  interface InternalAxiosRequestConfig {
    requestId?: string
    _retry?: boolean
    _refreshInfraError?: boolean
    skipErrorToast?: boolean
  }
}
