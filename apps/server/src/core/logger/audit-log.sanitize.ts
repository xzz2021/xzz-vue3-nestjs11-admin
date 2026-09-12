const SENSITIVE_KEY =
  /password|secret|token|cookie|authorization|credential|passwd/i;
const MAX_METADATA_BYTES = 8 * 1024;

export interface AuditRecordInput {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  success?: boolean;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** 清理审计日志中的敏感数据。 */
export function sanitizeAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (metadata == null) return null;
  const cleaned = redact(metadata);
  if (
    cleaned == null ||
    typeof cleaned !== "object" ||
    Array.isArray(cleaned)
  ) {
    return { value: cleaned };
  }
  const json = JSON.stringify(cleaned);
  if (json.length <= MAX_METADATA_BYTES)
    return cleaned as Record<string, unknown>;
  return { truncated: true, preview: json.slice(0, MAX_METADATA_BYTES) };
}

/** 递归清理敏感数据。 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MaxDepth]";
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, nested]) => {
      if (SENSITIVE_KEY.test(key)) return [key, "[Redacted]"] as const;
      return [key, redact(nested, depth + 1)] as const;
    },
  );
  return Object.fromEntries(entries);
}
