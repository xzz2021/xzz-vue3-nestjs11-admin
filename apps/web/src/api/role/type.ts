export interface RoleItem {
  id: string
  name: string
  code: string
  enabled: boolean
  sort: number
  description: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface RoleDetail extends RoleItem {
  createdById: string | null
  creatorName: string
  menuCount: number
  permissionCount: number
  userCount: number
}

export type DataScope = 'ALL' | 'SELF' | 'DEPT' | 'DEPT_TREE' | 'CUSTOM_DEFINE'
export type RolePermissionType = 'BUTTON' | 'DATA' | 'API' | 'OTHER'
export type RoleMenuType = 'DIRECTORY' | 'MENU'

export interface RolePermissionScopePayload {
  permissionId: string
  dataScope: DataScope
  departmentIds?: string[]
}

export interface RoleAuthorizationPermission {
  id: string
  name: string
  code: string
  resource: string | null
  action: string | null
  scopeEnabled: boolean
  type: RolePermissionType
  sort: number
  enabled: boolean
  menuId: string
  createdAt: string
  updatedAt: string
  checked: boolean
  dataScope: DataScope | null
  departmentIds: string[]
  disabledDepartmentIds: string[]
}

export interface RoleAuthorizationMenu {
  id: string
  parentId: string | null
  type: RoleMenuType
  name: string
  path: string
  component: string | null
  redirect: string | null
  title: string
  enabled: boolean
  keepAlive: boolean
  sort: number
  icon: string | null
  affix: boolean
  activeMenu: string | null
  alwaysShow: boolean
  breadcrumb: boolean
  canTo: boolean
  hidden: boolean
  noCache: boolean
  noTagsView: boolean
  external: boolean
  link: string | null
  createdAt: string
  updatedAt: string
  checked: boolean
  permissions: RoleAuthorizationPermission[]
  children: RoleAuthorizationMenu[]
}

export interface RoleMenuPayload {
  id: string
  permissionIds: string[]
  permissionScopes?: RolePermissionScopePayload[]
}

export interface RoleSubmitPayload {
  code: string
  name: string
  enabled: boolean
  description: string
  menus: RoleMenuPayload[]
}

export interface RoleUpdatePayload extends RoleSubmitPayload {
  id: string
}

export interface RoleListParams {
  pageIndex?: number
  pageSize?: number
  keyword?: string
  enabled?: boolean
}
