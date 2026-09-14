import { normalizeMenuType, type MenuItem, type MenuPermission, type PermissionType } from '@/api/menu/types'
import { cloneDeep, pick } from 'lodash-es'

export const MENU_FORM_FIELDS = [
  'type',
  'parentId',
  'name',
  'path',
  'component',
  'redirect',
  'title',
  'enabled',
  'sort',
  'icon',
  'affix',
  'activeMenu',
  'alwaysShow',
  'breadcrumb',
  'canTo',
  'hidden',
  'noCache',
  'noTagsView',
  'external',
  'link',
  'keepAlive'
] as const

export type MenuFormField = (typeof MENU_FORM_FIELDS)[number]

type PermissionLike = Partial<MenuPermission> & { label?: string; value?: string }

export const normalizePermissions = (list: PermissionLike[] = []): MenuPermission[] =>
  list.map((item) => ({
    id: item.id,
    name: item.name ?? item.label ?? '',
    code: item.code ?? item.value ?? '',
    type: (item.type ?? 'BUTTON') as PermissionType,
    sort: item.sort ?? 0,
    enabled: item.enabled ?? true,
    scopeEnabled: item.scopeEnabled ?? false,
    menuId: item.menuId
  }))

export const normalizeMenuRow = (row: MenuItem | null): Partial<MenuItem> | null => {
  if (!row) return null
  const normalized = cloneDeep(row) as Partial<MenuItem> & { meta?: Record<string, unknown> }

  if (normalized.meta) {
    Object.assign(normalized, normalized.meta)
    delete normalized.meta
  }

  normalized.permissions = normalizePermissions(normalized.permissions)
  if (normalized.type !== undefined) {
    normalized.type = normalizeMenuType(normalized.type)
  }

  return normalized
}

export const buildMenuPayload = (formData: Recordable) => {
  const payload = pick(formData, MENU_FORM_FIELDS) as Recordable
  if (!payload.parentId) {
    payload.parentId = null
  }
  if (formData.id) {
    payload.id = formData.id
  }
  return payload
}
