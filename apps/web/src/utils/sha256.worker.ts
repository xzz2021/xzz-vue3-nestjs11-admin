import { sha256 } from '@noble/hashes/sha2.js'

export type HashWorkerMessage =
  | { type: 'progress'; hashed: number; total: number }
  | { type: 'done'; hex: string }
  | { type: 'error'; message: string }

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    const file = event.data.file
    const hasher = sha256.create()
    const chunkSize = 2 * 1024 * 1024
    let offset = 0
    while (offset < file.size) {
      const slice = file.slice(offset, Math.min(offset + chunkSize, file.size))
      const buffer = new Uint8Array(await slice.arrayBuffer())
      hasher.update(buffer)
      offset += buffer.length
      self.postMessage({ type: 'progress', hashed: offset, total: file.size } satisfies HashWorkerMessage)
    }
    self.postMessage({ type: 'done', hex: toHex(hasher.digest()) } satisfies HashWorkerMessage)
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'hash failed'
    } satisfies HashWorkerMessage)
  }
}
