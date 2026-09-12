/** 把连接失败收成一行可读说明，避免 AggregateError 整栈刷屏 */
export function formatConnectFailure(
  service: string,
  target: string,
  error: unknown,
): string {
  const code = collectErrorCodes(error);
  if (code.has("ECONNREFUSED")) {
    return `${service} 未启动，无法连接 ${target}`;
  }
  if (code.has("ENOTFOUND") || code.has("EAI_AGAIN")) {
    return `${service} 主机名无法解析 ${target}`;
  }
  if (code.has("ETIMEDOUT") || /timeout|timed out/i.test(errorText(error))) {
    return `${service} 连接超时 ${target}`;
  }
  if (/password|AUTH|authentication failed/i.test(errorText(error))) {
    return `${service} 认证失败 ${target}`;
  }
  if (/Can't reach database|the database system is starting up/i.test(errorText(error))) {
    return `${service} 未就绪，无法连接 ${target}`;
  }
  const brief = briefMessage(error);
  return brief
    ? `${service} 连接失败 ${target}: ${brief}`
    : `${service} 连接失败 ${target}`;
}

function collectErrorCodes(error: unknown, codes = new Set<string>()): Set<string> {
  if (!error || typeof error !== "object") return codes;
  const record = error as { code?: unknown; errors?: unknown };
  if (typeof record.code === "string") codes.add(record.code);
  if (Array.isArray(record.errors)) {
    for (const inner of record.errors) collectErrorCodes(inner, codes);
  }
  return codes;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function briefMessage(error: unknown): string {
  if (error instanceof AggregateError && error.errors[0] instanceof Error) {
    return error.errors[0].message.split("\n")[0] ?? error.message;
  }
  if (error instanceof Error) return error.message.split("\n")[0] ?? "";
  return errorText(error).split("\n")[0] ?? "";
}
