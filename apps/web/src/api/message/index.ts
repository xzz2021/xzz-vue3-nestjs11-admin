import request from '@/axios'
import type { MessageListResult, MessageType, NoticeLevel, UnreadResult } from './types'

export const getMessageListApi = (params?: {
  pageIndex?: number
  pageSize?: number
  type?: MessageType
  unreadOnly?: boolean
}): Promise<IResponse<MessageListResult>> => {
  return request.get({ url: '/message/list', params })
}

export const getUnreadCountApi = (): Promise<IResponse<UnreadResult>> => {
  return request.get({ url: '/message/unreadCount' })
}

export const markMessageReadApi = (ids: string[]): Promise<IResponse<{ count: number; unread: number }>> => {
  return request.post({ url: '/message/read', data: { ids } })
}

export const markAllMessageReadApi = (): Promise<IResponse<{ count: number; unread: number }>> => {
  return request.post({ url: '/message/readAll' })
}

export const deleteMessageApi = (ids: string[]): Promise<IResponse<{ count: number; unread: number }>> => {
  return request.delete({ url: '/message', data: { ids } })
}

export const sendMailApi = (data: {
  receiverIds: string[]
  title: string
  content: string
  level?: NoticeLevel
}): Promise<IResponse> => {
  return request.post({ url: '/message/mail', data })
}

export const searchMessageReceiversApi = (
  keyword?: string
): Promise<IResponse<{ list: Array<{ id: string; username: string; nickname?: string | null; phone: string }> }>> => {
  return request.get({ url: '/message/receivers', params: { keyword } })
}

export const sendSystemApi = (data: { title: string; content: string; level?: NoticeLevel }): Promise<IResponse> => {
  return request.post({ url: '/message/system', data })
}

export const buildMessageWsUrl = (token: string): string => {
  const apiBase = String(import.meta.env.VITE_API_BASE_PATH || 'api/').replace(/^\/+|\/+$/g, '')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/${apiBase}/message/ws?token=${encodeURIComponent(token)}`
}
