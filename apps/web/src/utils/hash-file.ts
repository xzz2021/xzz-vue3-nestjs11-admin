import type { HashWorkerMessage } from './sha256.worker'

export const hashFileSha256 = (
  file: File,
  onProgress?: (hashed: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const worker = new Worker(new URL('./sha256.worker.ts', import.meta.url), { type: 'module' })
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }
    signal?.addEventListener('abort', onAbort)
    worker.onmessage = (event: MessageEvent<HashWorkerMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message.hashed, message.total)
        return
      }
      cleanup()
      if (message.type === 'done') {
        resolve(message.hex)
        return
      }
      reject(new Error(message.message))
    }
    worker.onerror = (error) => {
      cleanup()
      reject(error)
    }
    worker.postMessage({ file })
  })
}
