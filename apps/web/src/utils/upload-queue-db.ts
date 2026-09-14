const DB_NAME = 'file-upload-queue'
const STORE = 'items'

export interface PersistedQueueItem {
  localId: string
  name: string
  size: number
  lastModified: number
  mimeType: string
  sha256?: string
  sessionId?: string
  status: string
  hashedBytes: number
  uploadedBytes: number
  totalBytes: number
  chunkSize?: number
  totalChunks?: number
  uploadedChunks?: number[]
  error?: string
}

const openDb = (userId: string): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`${DB_NAME}:${userId}`, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const loadQueueItems = async (userId: string): Promise<PersistedQueueItem[]> => {
  const db = await openDb(userId)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => resolve((request.result || []) as PersistedQueueItem[])
    request.onerror = () => reject(request.error)
  })
}

export const saveQueueItem = async (userId: string, item: PersistedQueueItem) => {
  const db = await openDb(userId)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const deleteQueueItem = async (userId: string, localId: string) => {
  const db = await openDb(userId)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(localId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
