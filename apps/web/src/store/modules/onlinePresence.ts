import { buildOnlineWsUrl } from '@/api/online'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { store } from '../index'
import { useUserStore } from './user'

const PING_MS = 15_000
const MAX_AUTH_FAILS = 2

/**
 * 登录后维持 presence WebSocket，定期 ping，接收强制下线指令。
 */
export const useOnlinePresenceStore = defineStore('onlinePresence', () => {
  const connected = ref(false)
  let ws: WebSocket | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  let authFailCount = 0

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

  const forceLocalLogout = () => {
    disposed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    close()
    useUserStore().cmdLogout()
  }

  const sendPing = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ event: 'ping', data: {} }))
  }

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) return
    const userStore = useUserStore()
    if (!userStore.getToken) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 3000)
  }

  const connect = () => {
    const userStore = useUserStore()
    const token = userStore.getToken
    if (!token || disposed) return
    close()

    try {
      ws = new WebSocket(buildOnlineWsUrl(token))
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      connected.value = true
      authFailCount = 0
      sendPing()
      pingTimer = setInterval(sendPing, PING_MS)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { event?: string; data?: { message?: string; reason?: string } }
        if (msg.event === 'forceLogout') {
          forceLocalLogout()
          return
        }
        if (msg.event === 'error') {
          const message = msg.data?.message || ''
          if (message === 'unauthorized' || message === 'revoked' || message === 'invalid_token') {
            authFailCount += 1
            if (authFailCount >= MAX_AUTH_FAILS) {
              forceLocalLogout()
            }
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
      if (!disposed) {
        scheduleReconnect()
      }
    }
  }

  const start = () => {
    disposed = false
    authFailCount = 0
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
    connected,
    start,
    stop
  }
})

export const useOnlinePresenceStoreWithOut = () => useOnlinePresenceStore(store)
