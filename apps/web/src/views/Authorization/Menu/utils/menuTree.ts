import type { MenuItem } from '@/api/menu/types'
import { eachTree } from '@/utils/tree'
import { cloneDeep } from 'lodash-es'

export const findMenuById = (tree: MenuItem[], id: string): MenuItem | undefined => {
  let target: MenuItem | undefined
  eachTree(tree, (node: MenuItem) => {
    if (node.id === id) {
      target = node
    }
  })
  return target ? cloneDeep(target) : undefined
}

/** 收集节点及其全部子孙 ID */
export const collectDescendantIds = (tree: MenuItem[], rootId: string): Set<string> => {
  const ids = new Set<string>()

  const findNode = (nodes: MenuItem[]): MenuItem | undefined => {
    for (const node of nodes) {
      if (node.id === rootId) return node
      if (node.children?.length) {
        const found = findNode(node.children)
        if (found) return found
      }
    }
  }

  const addDescendants = (node: MenuItem) => {
    if (node.id) ids.add(node.id)
    node.children?.forEach(addDescendants)
  }

  const root = findNode(tree)
  if (root) addDescendants(root)
  return ids
}

/** 清理空 children，避免 TreeSelect 将叶子节点渲染为可展开项 */
export const pruneEmptyMenuChildren = (tree: MenuItem[]): MenuItem[] =>
  tree.map((node) => {
    const children = node.children?.length ? pruneEmptyMenuChildren(node.children) : undefined
    return {
      ...node,
      children: children?.length ? children : undefined
    }
  })

export type MenuTreeFilter = {
  keyword?: string
  enabled?: boolean | string | null
}

const hasEnabledFilter = (enabled: MenuTreeFilter['enabled']): enabled is boolean | string =>
  enabled === true || enabled === false || enabled === 'true' || enabled === 'false'

const toEnabledValue = (enabled: boolean | string) => enabled === true || enabled === 'true'

/** 按关键字/状态过滤菜单树（保留匹配节点及其祖先） */
export const filterMenuTree = (
  tree: MenuItem[],
  filters: MenuTreeFilter = {},
  getLabel?: (node: MenuItem) => string
): MenuItem[] => {
  const keyword = (filters.keyword || '').trim().toLowerCase()
  const enabledFiltered = hasEnabledFilter(filters.enabled)
  const enabledValue = enabledFiltered ? toEnabledValue(filters.enabled as boolean | string) : undefined

  if (!keyword && !enabledFiltered) return tree

  const matchNode = (node: MenuItem) => {
    const enabledMatched = !enabledFiltered || node.enabled === enabledValue
    if (!enabledMatched) return false
    if (!keyword) return true

    const texts = [node.title, node.name, node.path, getLabel?.(node)].filter(Boolean) as string[]
    return texts.some((text) => text.toLowerCase().includes(keyword))
  }

  const filterNodes = (nodes: MenuItem[]): MenuItem[] =>
    nodes
      .map((node) => {
        const children = node.children?.length ? filterNodes(node.children) : []
        if (matchNode(node) || children.length) {
          return { ...node, children: children.length ? children : undefined }
        }
        return null
      })
      .filter(Boolean) as MenuItem[]

  return filterNodes(tree)
}

/** 父级选择时排除自身及子孙节点 */
export const filterMenuTreeForParent = (tree: MenuItem[], excludeId?: string): MenuItem[] => {
  const cloned = cloneDeep(tree)
  const pruned = pruneEmptyMenuChildren(cloned)
  if (!excludeId) return pruned

  const excludeIds = collectDescendantIds(pruned, excludeId)

  const filterNodes = (nodes: MenuItem[]): MenuItem[] =>
    nodes
      .filter((node) => node.id && !excludeIds.has(node.id))
      .map((node) => ({
        ...node,
        children: node.children?.length ? filterNodes(node.children) : undefined
      }))

  return filterNodes(pruned)
}
