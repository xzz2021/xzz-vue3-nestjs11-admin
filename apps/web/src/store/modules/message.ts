import { buildMessageWsUrl, getUnreadCountApi } from '@/api/message'
import type { MessagePushPayload } from '@/api/message/types'
import { ElNotification } from 'element-plus'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { store } from '../index'
import { useUserStore } from './user'

const PING_MS = 30_000

/**
 * 消息 WS：未读数 + 右上角浮窗
 */
export const useMessageStore = defineStore('message', () => {
  const unread = ref(0)
  const connected = ref(false)
  let ws: WebSocket | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const setUnread = (n: number) => {
    unread.value = Math.max(0, n)
  }

  const fetchUnread = async () => {
    try {
      const res = await getUnreadCountApi()
      setUnread(res.data?.unread ?? 0)
    } catch {
      // ignore
    }
  }

  const notifyItems = (payload: MessagePushPayload) => {
    setUnread(payload.unread)
    for (const item of payload.items.slice(0, 3)) {
      const type =
        item.level === 'ERROR'
          ? 'error'
          : item.level === 'WARNING'
            ? 'warning'
            : item.level === 'SUCCESS'
              ? 'success'
              : 'info'
      const plainContent =
        new DOMParser().parseFromString(item.content, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() ||
        item.content
      ElNotification({
        title: item.title,
        message: plainContent,
        type,
        position: 'top-right',
        duration: 4500
      })
    }
  }

  const stopPing = () => {
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  const close = () => {
    stopPing()
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onerror = null
      ws.onclose = null
      try {
        ws.close()
      } catch {
        // ignore
      }
      ws = null
    }
    connected.value = false
  }

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) return
    if (!useUserStore().getToken) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 3000)
  }

  const connect = () => {
    const token = useUserStore().getToken
    if (!token || disposed) return
    close()
    try {
      ws = new WebSocket(buildMessageWsUrl(token))
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      connected.value = true
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'ping', data: {} }))
        }
      }, PING_MS)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          event?: string
          data?: MessagePushPayload & { unread?: number; message?: string }
        }
        if (msg.event === 'connected' && typeof msg.data?.unread === 'number') {
          setUnread(msg.data.unread)
        } else if (msg.event === 'message' && msg.data?.items) {
          notifyItems(msg.data as MessagePushPayload)
        } else if (msg.event === 'unread' && typeof msg.data?.unread === 'number') {
          setUnread(msg.data.unread)
        } else if (msg.event === 'error') {
          const m = msg.data?.message
          if (m === 'unauthorized' || m === 'revoked' || m === 'invalid_token') {
            stop()
          }
        }
      } catch {
        // ignore
      }
    }

    ws.onerror = () => {
      connected.value = false
    }

    ws.onclose = () => {
      connected.value = false
      stopPing()
      scheduleReconnect()
    }
  }

  const start = async () => {
    disposed = false
    await fetchUnread()
    connect()
  }

  const stop = () => {
    disposed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    close()
  }

  return {
    unread,
    connected,
    setUnread,
    fetchUnread,
    start,
    stop
  }
})

export const useMessageStoreWithOut = () => useMessageStore(store)
