import type { DataScope, RolePermissionScopePayload } from '@/api/role/type'
import { eachTree } from '@/utils/tree'
import { buildAssignedMenus, type RoleMenuTreeNode } from './roleMenuTree'

export const ROLE_MENU_PERMISSION_SNAPSHOT_TYPE = 'role-menu-permission' as const
export const ROLE_MENU_PERMISSION_SNAPSHOT_VERSION = 2 as const
const DATA_SCOPES: readonly DataScope[] = ['ALL', 'SELF', 'DEPT', 'DEPT_TREE', 'CUSTOM_DEFINE']

export interface RoleMenuPermissionSnapshotItem {
  id: string
  permissionIds: string[]
  permissionScopes: RolePermissionScopePayload[]
}

export interface RoleMenuPermissionSnapshotV2 {
  type: typeof ROLE_MENU_PERMISSION_SNAPSHOT_TYPE
  version: typeof ROLE_MENU_PERMISSION_SNAPSHOT_VERSION
  menus: RoleMenuPermissionSnapshotItem[]
}

interface RoleMenuPermissionSnapshotV1Item {
  id: string
  permissionIds: string[]
}

export interface RoleMenuPermissionSnapshotV1 {
  type: typeof ROLE_MENU_PERMISSION_SNAPSHOT_TYPE
  version: 1
  menus: RoleMenuPermissionSnapshotV1Item[]
}

export type RoleMenuPermissionSnapshot = RoleMenuPermissionSnapshotV1 | RoleMenuPermissionSnapshotV2

const uniqueStrings = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) return null
  return [...new Set(value)]
}

const isDataScope = (value: unknown): value is DataScope =>
  typeof value === 'string' && DATA_SCOPES.includes(value as DataScope)

export const buildRoleMenuPermissionSnapshot = (menuTree: RoleMenuTreeNode[]): RoleMenuPermissionSnapshotV2 => {
  const menus: RoleMenuPermissionSnapshotItem[] = buildAssignedMenus(menuTree).map((menu) => ({
    id: menu.id,
    permissionIds: menu.permissionIds,
    permissionScopes: menu.permissionScopes
      ? menu.permissionScopes.filter(
          (scope): scope is RolePermissionScopePayload =>
            scope.dataScope !== 'CUSTOM_DEFINE' || (scope.departmentIds?.length ?? 0) > 0
        )
      : []
  }))

  return {
    type: ROLE_MENU_PERMISSION_SNAPSHOT_TYPE,
    version: ROLE_MENU_PERMISSION_SNAPSHOT_VERSION,
    menus
  }
}

const parseV1Menus = (value: unknown): RoleMenuPermissionSnapshotV1Item[] | null => {
  if (!Array.isArray(value)) return null
  const menus: RoleMenuPermissionSnapshotV1Item[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id || seen.has(record.id)) return null
    const permissionIds = uniqueStrings(record.permissionIds)
    if (!permissionIds) return null
    menus.push({ id: record.id, permissionIds })
    seen.add(record.id)
  }
  return menus
}

const parsePermissionScopes = (
  value: unknown,
  permissionIds: ReadonlySet<string>
): RolePermissionScopePayload[] | null => {
  if (!Array.isArray(value)) return null
  const scopes: RolePermissionScopePayload[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const record = item as Record<string, unknown>
    if (
      typeof record.permissionId !== 'string' ||
      !record.permissionId ||
      !permissionIds.has(record.permissionId) ||
      seen.has(record.permissionId) ||
      !isDataScope(record.dataScope)
    ) {
      return null
    }
    const departmentIds = record.departmentIds === undefined ? undefined : uniqueStrings(record.departmentIds)
    if (record.departmentIds !== undefined && !departmentIds) return null
    if (record.dataScope === 'CUSTOM_DEFINE' && !departmentIds?.length) return null
    if (record.dataScope !== 'CUSTOM_DEFINE' && record.departmentIds !== undefined) return null
    if (record.dataScope === 'CUSTOM_DEFINE') {
      scopes.push({
        permissionId: record.permissionId,
        dataScope: record.dataScope,
        departmentIds: departmentIds as string[]
      })
    } else {
      scopes.push({
        permissionId: record.permissionId,
        dataScope: record.dataScope
      })
    }
    seen.add(record.permissionId)
  }
  return scopes
}

const parseV2Menus = (value: unknown): RoleMenuPermissionSnapshotItem[] | null => {
  if (!Array.isArray(value)) return null
  const menus: RoleMenuPermissionSnapshotItem[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id || seen.has(record.id)) return null
    const permissionIds = uniqueStrings(record.permissionIds)
    if (!permissionIds) return null
    const permissionScopes = parsePermissionScopes(record.permissionScopes, new Set(permissionIds))
    if (!permissionScopes) return null
    menus.push({ id: record.id, permissionIds, permissionScopes })
    seen.add(record.id)
  }
  return menus
}

export const parseRoleMenuPermissionSnapshot = (raw: string): RoleMenuPermissionSnapshot | null => {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (!data || data.type !== ROLE_MENU_PERMISSION_SNAPSHOT_TYPE) return null
    if (data.version === 1) {
      const menus = parseV1Menus(data.menus)
      return menus ? { type: ROLE_MENU_PERMISSION_SNAPSHOT_TYPE, version: 1, menus } : null
    }
    if (data.version === ROLE_MENU_PERMISSION_SNAPSHOT_VERSION) {
      const menus = parseV2Menus(data.menus)
      return menus
        ? { type: ROLE_MENU_PERMISSION_SNAPSHOT_TYPE, version: ROLE_MENU_PERMISSION_SNAPSHOT_VERSION, menus }
        : null
    }
    return null
  } catch {
    return null
  }
}

export interface ApplySnapshotResult {
  matchedMenuCount: number
  matchedPermissionCount: number
}

export const applyRoleMenuPermissionSnapshot = (
  menuTree: RoleMenuTreeNode[],
  snapshot: RoleMenuPermissionSnapshot
): ApplySnapshotResult => {
  const permissionMapByMenu = new Map<string, Set<string>>()
  const scopeMapByMenu = new Map<string, Map<string, RolePermissionScopePayload>>()
  for (const menu of snapshot.menus) {
    permissionMapByMenu.set(menu.id, new Set(menu.permissionIds))
  }
  if (snapshot.version === 2) {
    for (const menu of snapshot.menus) {
      scopeMapByMenu.set(
        menu.id,
        new Map(menu.permissionScopes.map((scope): [string, RolePermissionScopePayload] => [scope.permissionId, scope]))
      )
    }
  }
  let matchedMenuCount = 0
  let matchedPermissionCount = 0

  eachTree(menuTree, (node) => {
    const permissionIds = permissionMapByMenu.get(node.id)
    if (!permissionIds) return
    matchedMenuCount++
    matchedPermissionCount += node.permissions.filter(
      (permission: any) => permission.enabled && permissionIds.has(permission.id)
    ).length
  })

  if (!matchedMenuCount && !matchedPermissionCount) {
    return { matchedMenuCount, matchedPermissionCount }
  }

  eachTree(menuTree, (node) => {
    const permissionIds = permissionMapByMenu.get(node.id)
    const scopeMap = scopeMapByMenu.get(node.id)
    const checked = !!permissionIds
    node.checked = checked

    node.permissions.forEach((permission: any) => {
      const permissionChecked = permission.enabled && checked && !!permissionIds?.has(permission.id)
      permission.checked = permissionChecked
      permission.dataScope = null
      permission.departmentIds = []
      permission.disabledDepartmentIds = []
      const scope = permissionChecked ? scopeMap?.get(permission.id) : undefined
      if (scope && permission.scopeEnabled) {
        permission.dataScope = scope.dataScope
        permission.departmentIds = scope.dataScope === 'CUSTOM_DEFINE' ? [...(scope.departmentIds || [])] : []
      }
    })
  })

  return { matchedMenuCount, matchedPermissionCount }
}
