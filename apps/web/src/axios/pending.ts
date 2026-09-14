import type { InternalAxiosRequestConfig } from 'axios'

type PendingEntry = { controller: AbortController; url: string }

const pendingMap = new Map<string, PendingEntry>()

export const createPending = (url: string) => {
  const controller = new AbortController()
  const requestId = `${url}_${Date.now()}_${Math.random().toString(36).slice(2)}`
  pendingMap.set(requestId, { controller, url })
  return { controller, requestId }
}

export const cleanupPending = (config?: InternalAxiosRequestConfig) => {
  const requestId = config?.requestId
  if (requestId) {
    pendingMap.delete(requestId)
  }
}

export const cancelRequest = (url: string | string[]) => {
  const urlList = Array.isArray(url) ? url : [url]
  for (const [requestId, pending] of pendingMap) {
    if (urlList.some((u) => pending.url === u || pending.url.includes(u))) {
      pending.controller.abort()
      pendingMap.delete(requestId)
    }
  }
}

export const cancelAllRequest = () => {
  for (const [, pending] of pendingMap) {
    pending.controller.abort()
  }
  pendingMap.clear()
}

export const removePending = (requestId: string) => {
  pendingMap.delete(requestId)
}
