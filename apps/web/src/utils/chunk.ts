export type ListedPart = { partNumber: number; etag: string; size: number }

export class OssConflictError extends Error {
  constructor() {
    super('conflict')
    this.name = 'OssConflictError'
  }
}

export interface ChunkUploaderOptions {
  prefix: string
  filename?: string
  overwrite?: boolean
  concurrency?: number
  apiBase?: string
  pathPrefix?: string
  onProgress?: (p: { uploadedBytes: number; totalBytes: number }) => void
  signal?: AbortSignal
  headers?: Record<string, string>
}

type InitResponse = {
  data: { uploadId: string; key: string; partSize: number; partCount: number }
}
type PresignResponse = { data: { url: string } }
type ListPartsResponse = { data: { list: ListedPart[] } }

const unwrapJson = async <T>(res: Response): Promise<T> => {
  if (res.status === 409) throw new OssConflictError()
  if (!res.ok) throw new Error(`request failed: ${res.status}`)
  return (await res.json()) as T
}

export class ChunkUploader {
  readonly file: File
  readonly opts: ChunkUploaderOptions & { concurrency: number; apiBase: string; pathPrefix: string }
  uploadId?: string
  key = ''
  partSize = 8 * 1024 * 1024
  totalParts = 1
  private uploadedBytes = 0

  constructor(file: File, opts: ChunkUploaderOptions) {
    this.file = file
    this.opts = {
      ...opts,
      concurrency: Math.max(1, opts.concurrency ?? 4),
      apiBase: opts.apiBase ?? '',
      pathPrefix: opts.pathPrefix ?? 'oss/uploads'
    }
  }

  private url(path: string): string {
    return `${this.opts.apiBase}${this.opts.pathPrefix}${path}`
  }

  async uploadAll(): Promise<{ key: string }> {
    const filename = this.opts.filename || this.file.name
    const init = await unwrapJson<InitResponse>(
      await fetch(this.url('/multipart'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.opts.headers || {}) },
        body: JSON.stringify({
          prefix: this.opts.prefix,
          filename,
          contentType: this.file.type || 'application/octet-stream',
          size: this.file.size,
          overwrite: this.opts.overwrite ?? false
        }),
        signal: this.opts.signal
      })
    )
    this.uploadId = init.data.uploadId
    this.key = init.data.key
    this.partSize = init.data.partSize
    this.totalParts = init.data.partCount

    const listed = await unwrapJson<ListPartsResponse>(
      await fetch(
        `${this.url('/multipart/parts')}?${new URLSearchParams({ key: this.key, uploadId: this.uploadId })}`,
        { headers: { ...(this.opts.headers || {}) }, signal: this.opts.signal }
      )
    )
    const known: Record<number, string> = {}
    for (const part of listed.data.list || []) {
      known[part.partNumber] = part.etag.replace(/^"|"$/g, '')
      this.uploadedBytes += part.size
    }

    const missing: number[] = []
    for (let partNumber = 1; partNumber <= this.totalParts; partNumber++) {
      if (!known[partNumber]) missing.push(partNumber)
    }
    await this.uploadMissingParts(missing, known)

    const parts: { partNumber: number; etag: string }[] = []
    for (let partNumber = 1; partNumber <= this.totalParts; partNumber++) {
      const etag = known[partNumber]
      if (!etag) throw new Error(`part ${partNumber} missing after upload`)
      parts.push({ partNumber, etag })
    }
    await unwrapJson(
      await fetch(this.url('/multipart/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.opts.headers || {}) },
        body: JSON.stringify({ key: this.key, uploadId: this.uploadId, parts }),
        signal: this.opts.signal
      })
    )
    return { key: this.key }
  }

  async abort(): Promise<void> {
    if (!this.uploadId || !this.key) return
    await fetch(this.url('/multipart/abort'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.opts.headers || {}) },
      body: JSON.stringify({ key: this.key, uploadId: this.uploadId }),
      signal: this.opts.signal
    })
  }

  private async uploadMissingParts(partNumbers: number[], knownMap: Record<number, string>): Promise<void> {
    const pool = new Set<Promise<void>>()
    let idx = 0
    const runNext = async (): Promise<void> => {
      if (this.opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const partNumber = partNumbers[idx++]
      if (partNumber == null) return
      const task = this.uploadSinglePart(partNumber)
        .then(({ etag, bytes }) => {
          knownMap[partNumber] = etag
          this.uploadedBytes += bytes
          this.opts.onProgress?.({ uploadedBytes: this.uploadedBytes, totalBytes: this.file.size })
        })
        .finally(() => {
          pool.delete(task)
        })
      pool.add(task)
      if (pool.size >= this.opts.concurrency) await Promise.race(pool)
      await runNext()
    }
    await runNext()
    await Promise.all(pool)
  }

  private async uploadSinglePart(partNumber: number): Promise<{ etag: string; bytes: number }> {
    const start = (partNumber - 1) * this.partSize
    const end = Math.min(this.file.size, start + this.partSize)
    const chunk = this.file.slice(start, end)
    const query = new URLSearchParams({
      key: this.key,
      uploadId: this.uploadId as string,
      partNumber: String(partNumber)
    })
    const pres = await unwrapJson<PresignResponse>(
      await fetch(`${this.url('/multipart/presign-part')}?${query}`, {
        headers: { ...(this.opts.headers || {}) },
        signal: this.opts.signal
      })
    )
    const resp = await fetch(pres.data.url, {
      method: 'PUT',
      body: chunk,
      signal: this.opts.signal
    })
    if (!resp.ok) throw new Error(`part ${partNumber} put failed: ${resp.status}`)
    const etag = (resp.headers.get('etag') || '').replace(/^"|"$/g, '')
    if (!etag) throw new Error(`part ${partNumber} missing etag`)
    return { etag, bytes: end - start }
  }
}
