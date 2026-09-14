import type { DepartmentItem } from '@/api/department/types'

export type DepartmentTreeFilter = {
  name?: string
  enabled?: boolean | string
}

const hasEnabledFilter = (enabled: DepartmentTreeFilter['enabled']): enabled is boolean | string =>
  enabled === true || enabled === false || enabled === 'true' || enabled === 'false'

const toEnabledValue = (enabled: boolean | string) => enabled === true || enabled === 'true'

/** 按名称/状态过滤树（保留匹配节点及其祖先） */
export const filterDepartmentTree = (tree: DepartmentItem[], filters: DepartmentTreeFilter = {}): DepartmentItem[] => {
  const name = (filters.name || '').trim().toLowerCase()
  const enabledFiltered = hasEnabledFilter(filters.enabled)
  const enabledValue = enabledFiltered ? toEnabledValue(filters.enabled as boolean | string) : undefined

  if (!name && !enabledFiltered) return tree

  const matchNode = (node: DepartmentItem) => {
    const nameMatched = !name || node.name.toLowerCase().includes(name)
    const enabledMatched = !enabledFiltered || node.enabled === enabledValue
    return nameMatched && enabledMatched
  }

  const filterNodes = (nodes: DepartmentItem[]): DepartmentItem[] =>
    nodes
      .map((node) => {
        const children = node.children?.length ? filterNodes(node.children) : []
        if (matchNode(node) || children.length) {
          return { ...node, children: children.length ? children : undefined }
        }
        return null
      })
      .filter(Boolean) as DepartmentItem[]

  return filterNodes(tree)
}

/** 收集节点及其全部子孙 ID（含自身） */
export const collectDescendantIds = (tree: DepartmentItem[], rootId: string): Set<string> => {
  const ids = new Set<string>()

  const findNode = (nodes: DepartmentItem[]): DepartmentItem | undefined => {
    for (const node of nodes) {
      if (node.id === rootId) return node
      if (node.children?.length) {
        const found = findNode(node.children)
        if (found) return found
      }
    }
  }

  const add = (node: DepartmentItem) => {
    ids.add(node.id)
    node.children?.forEach(add)
  }

  const root = findNode(tree)
  if (root) add(root)
  return ids
}

/** 拍成与表格断开的纯对象树，供上级选择使用 */
export const snapshotDepartmentTree = (nodes: DepartmentItem[]): DepartmentItem[] =>
  nodes.map((node) => {
    const children = node.children?.length ? snapshotDepartmentTree(node.children) : undefined
    return {
      id: node.id,
      name: node.name,
      children: children?.length ? children : undefined,
    }
  })
