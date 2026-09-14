export interface LogUserItem {
  username: string
  phone: string
}

export interface LogItem {
  id: number
  user?: LogUserItem | null
  ip: string
  location?: string | null
  userAgent: string
  method: string
  requestUrl: string
  isSuccess: boolean
  responseMsg?: string | null
  detailInfo?: Record<string, any> | null
  duration: number
  createdAt: string
}

export interface LogListParams {
  pageIndex?: number
  pageSize?: number
  status?: 'success' | 'fail'
  method?: string
  requestUrl?: string
  responseMsg?: string
  dateRange?: string
}

export interface AuditLogUserItem {
  username: string
  phone?: string | null
}

export interface AuditLogItem {
  id: string
  userId?: string | null
  user?: AuditLogUserItem | null
  action: string
  resource: string
  resourceId?: string | null
  success: boolean
  ip?: string | null
  location?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface AuditLogListParams {
  pageIndex?: number
  pageSize?: number
  action?: string
  resource?: string
  resourceId?: string
  success?: boolean
  dateRange?: string
}
