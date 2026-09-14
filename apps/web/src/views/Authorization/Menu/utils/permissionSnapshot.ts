import type { MenuPermission, PermissionType } from '@/api/menu/types'
import { buildPermissionCode, getPermissionCodeSuffix, PERMISSION_CODE_SUFFIX_PATTERN } from './permissionCode'

export const MENU_PERMISSION_SNAPSHOT_TYPE = 'menu-permissions' as const
export const MENU_PERMISSION_SNAPSHOT_VERSION = 1 as const

export interface MenuPermissionSnapshotItem {
  name: string
  code: string
  type: PermissionType
  sort?: number
  enabled?: boolean
  scopeEnabled?: boolean
}

export interface MenuPermissionSnapshot {
  type: typeof MENU_PERMISSION_SNAPSHOT_TYPE
  version: typeof MENU_PERMISSION_SNAPSHOT_VERSION
  /** 来源菜单 path，用于提取编码后缀并适配目标菜单 */
  menuPath?: string
  permissions: MenuPermissionSnapshotItem[]
}

const PERMISSION_TYPES: PermissionType[] = ['BUTTON', 'DATA', 'API', 'OTHER']

const isPermissionType = (value: unknown): value is PermissionType =>
  typeof value === 'string' && PERMISSION_TYPES.includes(value as PermissionType)

export const buildMenuPermissionSnapshot = (
  permissions: MenuPermission[],
  menuPath?: string
): MenuPermissionSnapshot => ({
  type: MENU_PERMISSION_SNAPSHOT_TYPE,
  version: MENU_PERMISSION_SNAPSHOT_VERSION,
  menuPath: menuPath?.trim() || undefined,
  permissions: permissions.map((item) => ({
    name: item.name,
    code: item.code,
    type: item.type,
    sort: item.sort ?? 0,
    enabled: item.enabled ?? true,
    scopeEnabled: item.scopeEnabled ?? false
  }))
})

export const parseMenuPermissionSnapshot = (raw: string): MenuPermissionSnapshot | null => {
  try {
    const data = JSON.parse(raw) as Partial<MenuPermissionSnapshot>
    if (data?.type !== MENU_PERMISSION_SNAPSHOT_TYPE) return null
    if (data?.version !== MENU_PERMISSION_SNAPSHOT_VERSION) return null
    if (!Array.isArray(data.permissions) || !data.permissions.length) return null

    const permissions: MenuPermissionSnapshotItem[] = []
    for (const item of data.permissions) {
      if (!item || typeof item.name !== 'string' || !item.name.trim()) return null
      if (typeof item.code !== 'string' || !item.code.trim()) return null
      if (!isPermissionType(item.type)) return null

      const suffix = getPermissionCodeSuffix(item.code, data.menuPath)
      if (!PERMISSION_CODE_SUFFIX_PATTERN.test(suffix)) return null

      permissions.push({
        name: item.name.trim(),
        code: item.code.trim(),
        type: item.type,
        sort: typeof item.sort === 'number' ? item.sort : 0,
        enabled: item.enabled ?? true,
        scopeEnabled: item.scopeEnabled ?? false
      })
    }

    return {
      type: MENU_PERMISSION_SNAPSHOT_TYPE,
      version: MENU_PERMISSION_SNAPSHOT_VERSION,
      menuPath: typeof data.menuPath === 'string' ? data.menuPath : undefined,
      permissions
    }
  } catch {
    return null
  }
}

/** 将快照权限适配到目标菜单 path，并跳过编码冲突项 */
export const adaptPermissionSnapshotToMenu = (
  snapshot: MenuPermissionSnapshot,
  targetMenuPath: string,
  existingCodes: Set<string>
): { toCreate: MenuPermissionSnapshotItem[]; skippedDuplicate: number } => {
  const toCreate: MenuPermissionSnapshotItem[] = []
  let skippedDuplicate = 0
  const pendingCodes = new Set(existingCodes)

  for (const item of snapshot.permissions) {
    const suffix = getPermissionCodeSuffix(item.code, snapshot.menuPath)
    const code = buildPermissionCode(targetMenuPath, suffix)

    if (pendingCodes.has(code)) {
      skippedDuplicate++
      continue
    }

    pendingCodes.add(code)
    toCreate.push({
      name: item.name,
      code,
      type: item.type,
      sort: item.sort ?? 0,
      enabled: item.enabled ?? true,
      scopeEnabled: item.scopeEnabled ?? false
    })
  }

  return { toCreate, skippedDuplicate }
}
