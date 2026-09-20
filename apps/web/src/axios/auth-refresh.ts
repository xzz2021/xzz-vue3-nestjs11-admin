const SKIP_TOKEN_REFRESH_PATTERN = /(?:^|\/)(?:auth\/(?:rt\/login|refresh|register)|captcha\/)/i

export const shouldSkipTokenRefresh = (url?: string): boolean => {
  if (!url) return false
  return SKIP_TOKEN_REFRESH_PATTERN.test(url)
}

export const canAttemptTokenRefresh = (input: {
  status: number
  url?: string
  alreadyRetried: boolean
  hasAccessToken: boolean
}): boolean => {
  if (input.status !== 401 && input.status !== 406) return false
  if (!input.url || input.alreadyRetried) return false
  if (shouldSkipTokenRefresh(input.url)) return false
  // 内存 access 为空时仍需 refresh（F5 后仅剩 httpOnly rt）
  void input.hasAccessToken
  return true
}
