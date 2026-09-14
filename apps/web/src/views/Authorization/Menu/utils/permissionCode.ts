/** 菜单 path 转为权限编码前缀，如 authorization/department → authorization:department */
export const getPermissionCodePrefix = (menuPath?: string): string => {
  if (!menuPath?.trim()) return ''
  return menuPath.replace(/^\/+|\/+$/g, '').replace(/\//g, ':')
}

/** 从完整编码中提取用户可编辑的后缀 */
export const getPermissionCodeSuffix = (fullCode: string, menuPath?: string): string => {
  const prefix = getPermissionCodePrefix(menuPath)
  if (prefix && fullCode.startsWith(`${prefix}:`)) {
    return fullCode.slice(prefix.length + 1)
  }
  const parts = fullCode.split(':')
  return parts[parts.length - 1] ?? fullCode
}

/** 拼接完整权限编码，后缀仅允许字母、数字、下划线且以字母开头 */
export const buildPermissionCode = (menuPath: string, suffix: string): string => {
  const normalizedSuffix = suffix.trim()
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(normalizedSuffix)) {
    throw new Error('编码后缀只能包含字母、数字、中划线，且必须以字母开头')
  }
  const prefix = getPermissionCodePrefix(menuPath)
  return prefix ? `${prefix}:${normalizedSuffix}` : normalizedSuffix
}

export const PERMISSION_CODE_SUFFIX_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/
