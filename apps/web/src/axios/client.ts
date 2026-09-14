import { REQUEST_TIMEOUT, SUCCESS_CODE, TRANSFORM_REQUEST_DATA } from '@/constants'
import { objToFormData } from '@/utils'
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import qs from 'qs'
import { applyAuthHeader, refreshExpiredToken } from './auth'
import { getAxiosErrorMessage, showAxiosError } from './error'
import { cleanupPending } from './pending'

type BusinessResponse = {
  code?: number
  message?: unknown
}

const isBusinessResponse = (value: unknown): value is BusinessResponse => {
  return typeof value === 'object' && value !== null
}

export const PATH_URL = import.meta.env.VITE_API_BASE_PATH

export const axiosInstance = axios.create({
  baseURL: PATH_URL,
  timeout: REQUEST_TIMEOUT,
  paramsSerializer: {
    serialize: (params) => qs.stringify(params, { arrayFormat: 'repeat', skipNulls: true })
  }
})

const transformBody = (config: InternalAxiosRequestConfig) => {
  const method = config.method?.toLowerCase()
  const contentType = String(config.headers.get('Content-Type') || '')
  const supportsBody = method === 'post' || method === 'put' || method === 'patch'

  if (!supportsBody) return config

  if (contentType.includes('application/x-www-form-urlencoded')) {
    config.data = qs.stringify(config.data)
  } else if (
    TRANSFORM_REQUEST_DATA &&
    contentType.includes('multipart/form-data') &&
    !(config.data instanceof FormData)
  ) {
    config.data = objToFormData(config.data)
  }

  return config
}

axiosInstance.interceptors.request.use((config) => {
  applyAuthHeader(config)
  return transformBody(config)
})

axiosInstance.interceptors.response.use(
  (response: AxiosResponse<unknown>) => {
    cleanupPending(response.config)

    if (response.config.responseType === 'blob') {
      return response
    }

    const data = response.data
    if (isBusinessResponse(data) && data.code === SUCCESS_CODE) {
      return response
    }

    const message = isBusinessResponse(data) ? data.message || '请求失败' : '请求失败'
    const text = typeof message === 'string' ? message : String(message)
    showAxiosError(text)
    return Promise.reject(new Error(text))
  },
  async (error: AxiosError<unknown>) => {
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      cleanupPending(error.config)
      return Promise.reject(error)
    }

    const status = error.response?.status || 0
    const retryConfig = await refreshExpiredToken(status, error.config)
    if (retryConfig) {
      return axiosInstance.request(retryConfig)
    }

    cleanupPending(error.config)

    // access token 过期后若 refresh 因服务不可用失败，原请求仍是 401，需改成可理解的提示
    if (status === 401 && error.config?._refreshInfraError) {
      showAxiosError('服务暂时不可用，请稍后重试')
      return Promise.reject(error)
    }

    if (!error.config?.skipErrorToast) {
      showAxiosError(getAxiosErrorMessage(error))
    }
    return Promise.reject(error)
  }
)
