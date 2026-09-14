import { abortUploadApi, completeUploadApi, getUploadSessionApi, initiateUploadApi, uploadChunkApi } from '@/api/file'
import type { InitiateUploadResult } from '@/api/file/types'
import { cancelRequest } from '@/axios/pending'
import { hashFileSha256 } from '@/utils/hash-file'
import { deleteQueueItem, loadQueueItems, saveQueueItem, type PersistedQueueItem } from '@/utils/upload-queue-db'

export type QueueStatus = 'hashing' | 'waiting' | 'uploading' | 'paused' | 'instant' | 'success' | 'error' | 'aborted'

export interface UploadQueueItem extends PersistedQueueItem {
  status: QueueStatus
  needsReselect?: boolean
  file?: File
  speedBps?: number
}

const FILE_CONCURRENCY = 2
const CHUNK_CONCURRENCY = 4
const CHUNK_RETRIES = 3

const fingerprintOf = (file: Pick<File, 'name' | 'size' | 'lastModified'>) =>
  `${file.name}:${file.size}:${file.lastModified}`

const toPersisted = (item: UploadQueueItem): PersistedQueueItem => ({
  localId: item.localId,
  name: item.name,
  size: item.size,
  lastModified: item.lastModified,
  mimeType: item.mimeType,
  sha256: item.sha256,
  sessionId: item.sessionId,
  status: item.status,
  hashedBytes: item.hashedBytes,
  uploadedBytes: item.uploadedBytes,
  totalBytes: item.totalBytes,
  chunkSize: item.chunkSize,
  totalChunks: item.totalChunks,
  uploadedChunks: item.uploadedChunks,
  error: item.error
})

const shouldPersist = (status: QueueStatus) =>
  status === 'hashing' || status === 'waiting' || status === 'uploading' || status === 'paused' || status === 'error'

export class FileUploadQueue {
  items: UploadQueueItem[] = []
  private userId: string
  private onChange: () => void
  private onFinished: () => void
  private abortMap = new Map<string, AbortController>()
  private running = new Set<string>()
  private speedMarks = new Map<string, { at: number; bytes: number }>()

  constructor(userId: string, onChange: () => void, onFinished: () => void) {
    this.userId = userId
    this.onChange = onChange
    this.onFinished = onFinished
  }

  async hydrate() {
    const stored = await loadQueueItems(this.userId)
    this.items = stored
      .filter((item) => shouldPersist(item.status as QueueStatus))
      .map((item) => ({
        ...item,
        status: item.status as QueueStatus,
        needsReselect: true
      }))
    this.emit()
  }

  addFiles(files: File[]) {
    for (const file of files) {
      const existing = this.items.find((item) => item.needsReselect && fingerprintOf(item) === fingerprintOf(file))
      if (existing) {
        existing.file = file
        existing.needsReselect = false
        existing.error = undefined
        if (!existing.sha256) existing.status = 'hashing'
        else if (existing.status === 'error' || existing.status === 'paused') existing.status = 'waiting'
        continue
      }
      this.items.push({
        localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        mimeType: file.type || 'application/octet-stream',
        status: 'hashing',
        hashedBytes: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        file
      })
    }
    this.emit()
    void this.pump()
  }

  pause(localId: string) {
    const item = this.items.find((row) => row.localId === localId)
    if (!item || (item.status !== 'uploading' && item.status !== 'waiting' && item.status !== 'hashing')) return
    this.abortMap.get(localId)?.abort()
    this.cancelInflight(item.sessionId, 'chunks')
    item.status = 'paused'
    item.speedBps = undefined
    this.running.delete(localId)
    this.emit()
    void this.pump()
  }

  resume(localId: string) {
    const item = this.items.find((row) => row.localId === localId)
    if (!item || item.needsReselect) return
    if (item.status !== 'paused' && item.status !== 'error') return
    item.status = item.sha256 ? 'waiting' : 'hashing'
    item.error = undefined
    this.emit()
    void this.pump()
  }

  async cancel(localId: string) {
    const item = this.items.find((row) => row.localId === localId)
    if (!item) return
    this.abortMap.get(localId)?.abort()
    this.cancelInflight(item.sessionId)
    if (item.sessionId && item.status !== 'success' && item.status !== 'instant') {
      try {
        await abortUploadApi(item.sessionId)
      } catch {
        // 会话可能已过期
      }
    }
    this.items = this.items.filter((row) => row.localId !== localId)
    this.running.delete(localId)
    this.speedMarks.delete(localId)
    await deleteQueueItem(this.userId, localId)
    this.emit()
    void this.pump()
  }

  private emit() {
    this.onChange()
    for (const item of this.items) {
      if (shouldPersist(item.status) && !item.needsReselect) {
        void saveQueueItem(this.userId, toPersisted(item))
      }
    }
  }

  private async pump() {
    while (this.running.size < FILE_CONCURRENCY) {
      const next = this.items.find(
        (item) =>
          !this.running.has(item.localId) &&
          !item.needsReselect &&
          (item.status === 'hashing' || item.status === 'waiting' || item.status === 'uploading')
      )
      if (!next) return
      this.running.add(next.localId)
      void this.runItem(next).finally(() => {
        this.running.delete(next.localId)
        void this.pump()
      })
    }
  }

  private async runItem(item: UploadQueueItem) {
    const controller = new AbortController()
    this.abortMap.set(item.localId, controller)
    try {
      if (!item.file) {
        item.needsReselect = true
        this.emit()
        return
      }
      if (!item.sha256) {
        item.status = 'hashing'
        this.emit()
        item.sha256 = await hashFileSha256(
          item.file,
          (hashed, total) => {
            item.hashedBytes = hashed
            item.totalBytes = total
            this.emit()
          },
          controller.signal
        )
        this.emit()
        if (controller.signal.aborted) return
      }

      item.status = 'waiting'
      this.emit()
      const initiated = await initiateUploadApi({
        sha256: item.sha256,
        size: item.size,
        originalName: item.name,
        mimeType: item.mimeType
      })
      if (controller.signal.aborted) return
      const result = initiated.data as InitiateUploadResult
      if (result.outcome === 'instant' || result.outcome === 'restored') {
        item.status = 'instant'
        await deleteQueueItem(this.userId, item.localId)
        this.emit()
        this.onFinished()
        return
      }

      if (result.outcome !== 'created' && result.outcome !== 'resumed') {
        throw new Error('未知的上传结果')
      }

      item.sessionId = result.sessionId
      item.chunkSize = result.chunkSize
      item.totalChunks = result.totalChunks
      item.uploadedChunks = result.uploadedChunks
      item.uploadedBytes = result.uploadedChunks.length * result.chunkSize
      if (item.uploadedBytes > item.size) item.uploadedBytes = item.size
      item.status = 'uploading'
      this.emit()

      await this.uploadMissingChunks(item, controller.signal)
      if (controller.signal.aborted) return

      await completeUploadApi(result.sessionId)
      item.status = 'success'
      item.uploadedBytes = item.size
      await deleteQueueItem(this.userId, item.localId)
      this.emit()
      this.onFinished()
    } catch (error) {
      if (controller.signal.aborted || item.status === 'paused') return
      if (error instanceof DOMException && error.name === 'AbortError') return
      item.status = 'error'
      item.error = error instanceof Error ? error.message : '上传失败'
      this.emit()
    } finally {
      this.abortMap.delete(item.localId)
    }
  }

  private async uploadMissingChunks(item: UploadQueueItem, signal: AbortSignal) {
    if (!item.file || !item.sessionId || !item.chunkSize || !item.totalChunks) return
    if (item.sessionId) {
      try {
        const live = await getUploadSessionApi(item.sessionId)
        item.uploadedChunks = live.data.uploadedChunks
      } catch {
        // 用本地记录继续
      }
    }
    const uploaded = new Set(item.uploadedChunks || [])
    const pending = Array.from({ length: item.totalChunks }, (_, index) => index).filter(
      (index) => !uploaded.has(index)
    )
    let cursor = 0
    const workers = Array.from({ length: Math.min(CHUNK_CONCURRENCY, pending.length || 1) }, async () => {
      while (cursor < pending.length) {
        if (signal.aborted) return
        const index = pending[cursor++]
        if (index === undefined) return
        await this.uploadOneChunk(item, index, signal)
        uploaded.add(index)
        item.uploadedChunks = Array.from(uploaded)
        item.uploadedBytes = Math.min(item.size, uploaded.size * (item.chunkSize || 0))
        this.noteSpeed(item)
        this.emit()
      }
    })
    await Promise.all(workers)
  }

  private async uploadOneChunk(item: UploadQueueItem, index: number, signal: AbortSignal) {
    if (!item.file || !item.sessionId || !item.chunkSize) return
    const start = index * item.chunkSize
    const end = Math.min(start + item.chunkSize, item.file.size)
    const blob = item.file.slice(start, end)
    let lastError: unknown
    for (let attempt = 0; attempt < CHUNK_RETRIES; attempt++) {
      if (signal.aborted) return
      try {
        await uploadChunkApi(item.sessionId, index, blob, (event) => {
          const doneChunks = (item.uploadedChunks || []).length
          const base = doneChunks * (item.chunkSize || 0)
          item.uploadedBytes = Math.min(item.size, base + event.loaded)
          this.noteSpeed(item)
          this.emit()
        })
        return
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('分片上传失败')
  }

  private cancelInflight(sessionId?: string, suffix?: 'chunks') {
    if (!sessionId) return
    const url = suffix ? `staticfile/uploads/${sessionId}/chunks` : `staticfile/uploads/${sessionId}`
    cancelRequest(url)
  }

  private noteSpeed(item: UploadQueueItem) {
    const now = Date.now()
    const prev = this.speedMarks.get(item.localId)
    if (prev && now > prev.at) {
      item.speedBps = Math.max(0, ((item.uploadedBytes - prev.bytes) / (now - prev.at)) * 1000)
    }
    this.speedMarks.set(item.localId, { at: now, bytes: item.uploadedBytes })
  }
}
