import request from '@/axios'
import type { MonitorPayload } from './types'

/** HTTP 兜底：WS 不可用时拉取监控快照 */
export const getMonitorSnapshotApi = (): Promise<IResponse<MonitorPayload>> => {
  return request.get({ url: '/monitor/snapshot' })
}

/**
 * 构造监控 WebSocket 地址（走 Vite / Nginx 的 /api 代理）
 */
export const buildMonitorWsUrl = (token: string): string => {
  const apiBase = String(import.meta.env.VITE_API_BASE_PATH || 'api/').replace(/^\/+|\/+$/g, '')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/${apiBase}/monitor/ws?token=${encodeURIComponent(token)}`
}
