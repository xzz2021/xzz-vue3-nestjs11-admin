export type OnlineStatus = 'online' | 'away'

export interface OnlineUserItem {
  jti: string
  userId: string
  username: string
  phone: string
  ip: string
  location?: string
  userAgent: string
  browser: string
  os: string
  device: string
  loginAt: number
  lastPingAt: number
  exp: number
  status: OnlineStatus
  isSuperAdmin?: boolean
  isSelf?: boolean
  kickable?: boolean
}

export interface OnlineListResult {
  list: OnlineUserItem[]
  total: number
  onlineCount: number
  awayCount: number
}
