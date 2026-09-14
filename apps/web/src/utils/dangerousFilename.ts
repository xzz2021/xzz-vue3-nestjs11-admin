/**
 * 必须与 apps/server/src/processor/constants/filename.ts 的 DANGEROUS_FILENAME_RE 保持一致。
 */
export const DANGEROUS_FILENAME_RE = /\.(php|phtml|asp|aspx|exe|sh|bat|cmd|js|mjs|cjs|html|htm|shtml)(\.|$)/i

const MAX_SEGMENT_CHARS = 255
const MAX_KEY_BYTES = 1024

export class OssKeyError extends Error {
  constructor(message = '对象名称或路径不合法') {
    super(message)
    this.name = 'OssKeyError'
  }
}

export function assertObjectSegment(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new OssKeyError()
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) throw new OssKeyError()
  if (trimmed === '.' || trimmed === '..') throw new OssKeyError()
  if (trimmed.length > MAX_SEGMENT_CHARS) throw new OssKeyError()
  if (DANGEROUS_FILENAME_RE.test(trimmed)) throw new OssKeyError()
  return trimmed
}

export function normalizePrefix(prefix?: string | null): string {
  const raw = (prefix ?? '').replace(/\\/g, '/').trim()
  if (!raw) return ''
  const parts = raw.split('/').filter((part) => part !== '')
  for (const part of parts) {
    assertObjectSegment(part)
  }
  return `${parts.join('/')}/`
}

function assertKeyLength(key: string): string {
  if (new TextEncoder().encode(key).length > MAX_KEY_BYTES) throw new OssKeyError()
  return key
}

export function joinObjectKey(prefix: string | undefined | null, filename: string): string {
  return assertKeyLength(`${normalizePrefix(prefix)}${assertObjectSegment(filename)}`)
}

export function joinFolderKey(prefix: string | undefined | null, name: string): string {
  return assertKeyLength(`${joinObjectKey(prefix, name)}/`)
}

export function joinRelativeKey(
  prefix: string | undefined | null,
  relativePath: string
): { prefix: string; filename: string; key: string } {
  const segments = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part !== '')
  if (!segments.length) throw new OssKeyError()
  const filename = segments.pop() as string
  let current = normalizePrefix(prefix)
  for (const segment of segments) {
    current = joinFolderKey(current, segment)
  }
  const key = joinObjectKey(current, filename)
  return { prefix: current, filename: assertObjectSegment(filename), key }
}

export function folderNameFromPrefix(prefix: string): string {
  const parts = prefix.split('/').filter(Boolean)
  return parts[parts.length - 1] || prefix
}

export function breadcrumbSegments(prefix: string): { name: string; prefix: string }[] {
  const parts = normalizePrefix(prefix).split('/').filter(Boolean)
  const items: { name: string; prefix: string }[] = []
  let current = ''
  for (const part of parts) {
    current = `${current}${part}/`
    items.push({ name: part, prefix: current })
  }
  return items
}
