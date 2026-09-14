import { useUserStoreWithOut } from '@/store/modules/user'
import axios, { type InternalAxiosRequestConfig } from 'axios'

type RefreshResponse = {
  data?: {
    access_token?: string
  }
}

let refreshPromise: Promise<string> | null = null

const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_PATH,
  withCredentials: true
})

const requestNewToken = async (): Promise<string> => {
  const response = await refreshClient.post<RefreshResponse>('/auth/refresh')
  const token = response.data?.data?.access_token

  if (!token) {
    throw new Error('刷新接口未返回 access_token')
  }

  return token
}

const refreshToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = requestNewToken().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export const applyAuthHeader = (config: InternalAxiosRequestConfig, token?: string) => {
  const userStore = useUserStoreWithOut()
  const accessToken = token ?? userStore.getToken

  if (accessToken) {
    config.headers.set(userStore.getTokenKey || 'Authorization', `Bearer ${accessToken}`)
  }

  return config
}

export const refreshExpiredToken = async (
  status: number,
  config?: InternalAxiosRequestConfig
): Promise<InternalAxiosRequestConfig | null> => {
  const userStore = useUserStoreWithOut()
  const currentToken = userStore.getToken

  if ((status !== 401 && status !== 406) || !config || config._retry || !currentToken) {
    return null
  }

  config._retry = true
  const headerKey = userStore.getTokenKey || 'Authorization'
  const requestToken = String(config.headers.get(headerKey) || '')

  // 其他并发请求可能已经刷新成功，直接用最新 Token 重试即可。
  if (requestToken !== `Bearer ${currentToken}`) {
    return applyAuthHeader(config, currentToken)
  }

  try {
    const token = await refreshToken()
    userStore.setToken(token)
    return applyAuthHeader(config, token)
  } catch (error: unknown) {
    // 仅鉴权失败才登出；503/500 等基础设施故障保留登录态，避免误提示「登录过期」
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      userStore.logout()
    } else {
      config._refreshInfraError = true
    }
    return null
  }
}
