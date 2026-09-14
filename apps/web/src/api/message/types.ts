export type MessageType = 'MAIL' | 'SYSTEM' | 'ALERT'
export type NoticeLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

export interface MessageItem {
  id: string
  type: MessageType
  title: string
  content: string
  level: NoticeLevel
  readAt: string | null
  createdAt: string
  senderId: string | null
  sender?: { id: string; username: string } | null
  meta?: unknown
}

export interface MessageListResult {
  list: MessageItem[]
  total: number
  unread: number
  pageIndex: number
  pageSize: number
}

export interface UnreadResult {
  unread: number
}

export interface MessagePushItem {
  id: string
  type: MessageType
  title: string
  content: string
  level: NoticeLevel
  createdAt: string
  senderId?: string | null
  senderName?: string | null
}

export interface MessagePushPayload {
  userId: string
  unread: number
  items: MessagePushItem[]
}
