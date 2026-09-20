type RoutePermissionMeta = {
  permissions?: unknown
  permission?: unknown
}

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return undefined
  }
  return value
}

/** 路由按钮权限只认 meta.permissions；旧的 meta.permission 仅作兼容回退。 */
export const getRoutePermissions = (meta?: RoutePermissionMeta | null): string[] => {
  return asStringArray(meta?.permissions) ?? asStringArray(meta?.permission) ?? []
}
