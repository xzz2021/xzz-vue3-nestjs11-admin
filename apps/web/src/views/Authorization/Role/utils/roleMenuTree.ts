import type { DepartmentItem } from '@/api/department/types'
import type { DataScope, RoleAuthorizationMenu, RoleAuthorizationPermission, RoleSubmitPayload } from '@/api/role/type'

export interface RoleFormModel {
  id?: string
  name: string
  code: string
  enabled: boolean
  description?: string | null
}

export type RoleSubmitData = RoleSubmitPayload
export type RoleMenuPermissionItem = RoleAuthorizationPermission
export type RoleMenuTreeNode = RoleAuthorizationMenu

export const ROLE_PERMISSION_TYPE_I18N: Record<string, string> = {
  BUTTON: 'role.permissionTypeButton',
  DATA: 'role.permissionTypeData',
  API: 'role.permissionTypeApi',
  OTHER: 'role.permissionTypeOther'
}

export const DATA_SCOPE_I18N: Record<DataScope, string> = {
  ALL: 'role.dataScopeAll',
  SELF: 'role.dataScopeSelf',
  DEPT: 'role.dataScopeDepartment',
  DEPT_TREE: 'role.dataScopeDepartmentTree',
  CUSTOM_DEFINE: 'role.dataScopeCustom'
}

export const filterRoleMenuNode = (value: string, data: RoleMenuTreeNode) => {
  if (!value) return true
  return data.title?.toLowerCase().includes(value.toLowerCase())
}

export const findFirstMenuNode = (tree: RoleMenuTreeNode[]): RoleMenuTreeNode | undefined => {
  for (const node of tree) {
    if (node.permissions?.length) return node
    if (node.children?.length) {
      const found = findFirstMenuNode(node.children)
      if (found) return found
    }
  }
  return tree[0]
}

export const getMenuPermissionCount = (node: RoleMenuTreeNode) => {
  const enabledPermissions = node.permissions.filter((permission) => permission.enabled)
  const total = enabledPermissions.length
  const selected = enabledPermissions.filter((permission) => permission.checked).length
  return { selected, total }
}

// ElTree 默认父子联动：把已勾选的父节点传给 setCheckedKeys 会把全部子节点勾上。
// 回显时只传叶子节点，父节点由子节点自动变成全选或半选。
export const collectEchoCheckedKeys = (tree: RoleMenuTreeNode[]): string[] => {
  const keys: string[] = []
  const walk = (nodes: RoleMenuTreeNode[]) => {
    for (const node of nodes) {
      if (node.children?.length) {
        walk(node.children)
        continue
      }
      if (node.checked) keys.push(node.id)
    }
  }
  walk(tree)
  return keys
}

export const groupPermissionsByType = (permissions: RoleMenuPermissionItem[]) => {
  const groups = new Map<string, RoleMenuPermissionItem[]>()
  for (const permission of permissions) {
    const type = permission.type || 'OTHER'
    const list = groups.get(type) || []
    list.push(permission)
    groups.set(type, list)
  }
  return Array.from(groups.entries()).map(([type, items]) => ({ type, permissions: items }))
}

export const clearPermissionScope = (permission: RoleMenuPermissionItem) => {
  permission.dataScope = null
  permission.departmentIds = []
  permission.disabledDepartmentIds = []
}

export const clearPermissionSelection = (permission: RoleMenuPermissionItem) => {
  permission.checked = false
  clearPermissionScope(permission)
}

export type RoleScopeValidationReason =
  'required' | 'customRequired' | 'invalidDepartments' | 'departmentUnavailable' | 'nonCustomDepartments'

export interface RoleScopeValidationIssue {
  menu: RoleMenuTreeNode
  permission: RoleMenuPermissionItem
  reason: RoleScopeValidationReason
}

export interface RoleScopeValidationContext {
  departments: DepartmentItem[]
  departmentLoaded: boolean
  departmentLoadError: boolean
}

const flattenDepartments = (departments: DepartmentItem[], result: DepartmentItem[] = []): DepartmentItem[] => {
  for (const department of departments) {
    result.push(department)
    if (department.children?.length) flattenDepartments(department.children, result)
  }
  return result
}

export const findFirstRoleScopeIssue = (
  tree: RoleMenuTreeNode[],
  context: RoleScopeValidationContext
): RoleScopeValidationIssue | null => {
  const departments = flattenDepartments(context.departments)
  const enabledDepartmentIds = new Set(
    departments.filter((department) => department.enabled !== false).map((department) => department.id)
  )
  let issue: RoleScopeValidationIssue | null = null

  const walk = (nodes: RoleMenuTreeNode[]) => {
    for (const menu of nodes) {
      for (const permission of menu.permissions) {
        if (!permission.enabled || !permission.checked || !permission.scopeEnabled) continue
        if (!permission.dataScope) {
          issue = { menu, permission, reason: 'required' }
          return
        }
        if (permission.dataScope !== 'CUSTOM_DEFINE') {
          if (permission.departmentIds.length || permission.disabledDepartmentIds.length) {
            issue = { menu, permission, reason: 'nonCustomDepartments' }
            return
          }
          continue
        }
        if (!permission.departmentIds.length) {
          issue = { menu, permission, reason: 'customRequired' }
          return
        }
        if (!context.departmentLoaded || context.departmentLoadError) {
          issue = { menu, permission, reason: 'departmentUnavailable' }
          return
        }
        if (permission.departmentIds.some((id) => !enabledDepartmentIds.has(id))) {
          issue = { menu, permission, reason: 'invalidDepartments' }
          return
        }
      }
      if (menu.children.length) {
        walk(menu.children)
        if (issue) return
      }
    }
  }
  walk(tree)
  return issue
}

export const buildAssignedMenus = (tree: RoleMenuTreeNode[]): RoleSubmitData['menus'] => {
  const menuMap = new Map<string, RoleMenuTreeNode>()
  const walkMap = (nodes: RoleMenuTreeNode[]) => {
    for (const node of nodes) {
      menuMap.set(node.id, node)
      if (node.children.length) walkMap(node.children)
    }
  }
  walkMap(tree)

  const menus: RoleSubmitData['menus'] = []
  const menuIds = new Set<string>()

  const appendMenu = (node: RoleMenuTreeNode) => {
    if (menuIds.has(node.id)) return
    menuIds.add(node.id)
    const checkedPermissions = node.permissions.filter((item) => item.enabled && item.checked)
    menus.push({
      id: node.id,
      permissionIds: checkedPermissions.map((item) => item.id),
      permissionScopes: checkedPermissions
        .filter(
          (permission): permission is RoleMenuPermissionItem & { dataScope: DataScope } =>
            permission.scopeEnabled && permission.dataScope !== null
        )
        .map((permission) => ({
          permissionId: permission.id,
          dataScope: permission.dataScope,
          ...(permission.dataScope === 'CUSTOM_DEFINE' ? { departmentIds: [...new Set(permission.departmentIds)] } : {})
        }))
    })
  }

  const appendAncestors = (node: RoleMenuTreeNode) => {
    let parentId = node.parentId
    while (parentId) {
      const parent = menuMap.get(parentId)
      if (!parent) break
      appendMenu(parent)
      parentId = parent.parentId
    }
  }

  const walk = (nodes: RoleMenuTreeNode[]) => {
    for (const node of nodes) {
      if (node.checked) {
        appendMenu(node)
        appendAncestors(node)
      }
      if (node.children.length) walk(node.children)
    }
  }
  walk(tree)
  return menus
}

export const collectRoleSubmitData = (form: RoleFormModel, tree: RoleMenuTreeNode[]): RoleSubmitData => {
  return {
    code: form.code,
    name: form.name,
    enabled: form.enabled,
    description: form.description || '',
    menus: buildAssignedMenus(tree)
  }
}
