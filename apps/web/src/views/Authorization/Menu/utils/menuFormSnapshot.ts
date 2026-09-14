import { isDirectoryMenu, isPageMenu, normalizeMenuType, type MenuItem } from '@/api/menu/types'
import { eachTree } from '@/utils/tree'
import { MENU_FORM_FIELDS, type MenuFormField } from './menuForm'

export const MENU_FORM_SNAPSHOT_TYPE = 'menu-form' as const
export const MENU_FORM_SNAPSHOT_VERSION = 1 as const

/** 可复制/导入的菜单字段（不含 id / permissions） */
export const MENU_FORM_SNAPSHOT_FIELDS = MENU_FORM_FIELDS

export type MenuFormSnapshotField = MenuFormField

export type MenuFormSnapshotData = Partial<Pick<MenuItem, MenuFormSnapshotField>>

export interface MenuFormSnapshot {
  type: typeof MENU_FORM_SNAPSHOT_TYPE
  version: typeof MENU_FORM_SNAPSHOT_VERSION
  menu: MenuFormSnapshotData
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const buildMenuFormSnapshot = (formData: Recordable): MenuFormSnapshot => {
  const menu: MenuFormSnapshotData = {}
  for (const field of MENU_FORM_SNAPSHOT_FIELDS) {
    if (formData[field] !== undefined) {
      ;(menu as Recordable)[field] = formData[field]
    }
  }
  return {
    type: MENU_FORM_SNAPSHOT_TYPE,
    version: MENU_FORM_SNAPSHOT_VERSION,
    menu
  }
}

export const parseMenuFormSnapshot = (raw: string): MenuFormSnapshot | null => {
  try {
    const data = JSON.parse(raw) as Partial<MenuFormSnapshot>
    if (data?.type !== MENU_FORM_SNAPSHOT_TYPE) return null
    if (data?.version !== MENU_FORM_SNAPSHOT_VERSION) return null
    if (!isPlainObject(data.menu)) return null

    const menu: MenuFormSnapshotData = {}
    for (const field of MENU_FORM_SNAPSHOT_FIELDS) {
      if (data.menu[field] !== undefined) {
        ;(menu as Recordable)[field] = data.menu[field]
      }
    }

    if (typeof menu.title !== 'string' || !menu.title.trim()) return null
    if (typeof menu.path !== 'string' || !menu.path.trim()) return null
    if (!isDirectoryMenu(menu.type) && !isPageMenu(menu.type)) return null
    menu.type = normalizeMenuType(menu.type)

    return {
      type: MENU_FORM_SNAPSHOT_TYPE,
      version: MENU_FORM_SNAPSHOT_VERSION,
      menu
    }
  } catch {
    return null
  }
}

export const collectMenuNames = (tree: MenuItem[], excludeId?: string): Set<string> => {
  const names = new Set<string>()
  eachTree(tree, (node: MenuItem) => {
    if (node.id && excludeId && node.id === excludeId) return
    if (node.name) names.add(node.name)
  })
  return names
}

export const collectMenuIds = (tree: MenuItem[]): Set<string> => {
  const ids = new Set<string>()
  eachTree(tree, (node: MenuItem) => {
    if (node.id) ids.add(node.id)
  })
  return ids
}

export interface PrepareMenuFormImportResult {
  values: MenuFormSnapshotData
  nameConflict: boolean
  parentCleared: boolean
}

/** 处理导入值：校验 name 唯一、parentId 有效 */
export const prepareMenuFormImport = (
  snapshot: MenuFormSnapshot,
  options: {
    existingNames: Set<string>
    existingIds: Set<string>
  }
): PrepareMenuFormImportResult => {
  const values: MenuFormSnapshotData = { ...snapshot.menu }
  let nameConflict = false
  let parentCleared = false

  if (values.name && options.existingNames.has(values.name)) {
    nameConflict = true
    values.name = ''
  }

  if (values.parentId && !options.existingIds.has(values.parentId)) {
    values.parentId = null
    parentCleared = true
  }

  return { values, nameConflict, parentCleared }
}
