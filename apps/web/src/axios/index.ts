import { axiosInstance } from './client'
import { cancelAllRequest, cancelRequest, createPending, removePending } from './pending'
import type { CancellablePromise, DownloadResponse, RequestConfig } from './types'

type JsonAxiosConfig = Omit<AxiosConfig, 'responseType'>

const withCancel = <T>(url: string, send: (config: RequestConfig) => Promise<T>): CancellablePromise<T> => {
  const { controller, requestId } = createPending(url || '')
  const promise = send({
    signal: controller.signal,
    requestId
  }) as CancellablePromise<T>

  promise.cancel = () => {
    controller.abort()
    removePending(requestId)
  }

  return promise
}

/** JSON 业务请求：始终返回拦截器解包后的 `response.data`（IResponse）。 */
const requestData = <T>(option: JsonAxiosConfig): CancellablePromise<T> => {
  const { url, method, params, data, headers, withCredentials, timeout, onUploadProgress, skipErrorToast } = option

  return withCancel(url || '', (pending) =>
    axiosInstance
      .request<T>({
        url,
        method,
        params,
        data,
        headers,
        withCredentials,
        timeout,
        onUploadProgress,
        skipErrorToast,
        ...pending
      })
      .then((response) => response.data)
  )
}

/** 文件下载：固定 blob，返回文件体和响应头（用于 Content-Disposition 文件名）。 */
const download = (option: JsonAxiosConfig): CancellablePromise<DownloadResponse> => {
  const { url, method = 'get', params, data, headers, withCredentials } = option

  return withCancel(url || '', (pending) =>
    axiosInstance
      .request<Blob>({
        url,
        method,
        params,
        data,
        headers,
        withCredentials,
        responseType: 'blob',
        ...pending
      })
      .then((response) => ({
        data: response.data,
        headers: response.headers
      }))
  )
}

const http = {
  get: <T = any>(option: JsonAxiosConfig) => {
    return requestData<IResponse<T>>({ method: 'get', ...option })
  },
  post: <T = any>(option: JsonAxiosConfig) => {
    return requestData<IResponse<T>>({ method: 'post', ...option })
  },
  delete: <T = any>(option: JsonAxiosConfig) => {
    return requestData<IResponse<T>>({ method: 'delete', ...option })
  },
  put: <T = any>(option: JsonAxiosConfig) => {
    return requestData<IResponse<T>>({ method: 'put', ...option })
  },
  download,
  cancelRequest,
  cancelAllRequest
}

export default http
export { PATH_URL } from './client'
export type { CancellablePromise, DownloadResponse } from './types'
