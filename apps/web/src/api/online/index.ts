import request from '@/axios'
import type { OnlineListResult } from './types'

export const getOnlineListApi = (params?: { keyword?: string }): Promise<IResponse<OnlineListResult>> => {
  return request.get({ url: '/online/list', params })
}

export const kickOnlineSessionApi = (data: { jti: string; userId: string }): Promise<IResponse> => {
  return request.post({ url: '/online/kick', data })
}

export const kickOnlineUserApi = (userId: string): Promise<IResponse> => {
  return request.post({ url: '/online/kickUser', data: { userId } })
}

export const buildOnlineWsUrl = (token: string): string => {
  const apiBase = String(import.meta.env.VITE_API_BASE_PATH || 'api/').replace(/^\/+|\/+$/g, '')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/${apiBase}/online/ws?token=${encodeURIComponent(token)}`
}
