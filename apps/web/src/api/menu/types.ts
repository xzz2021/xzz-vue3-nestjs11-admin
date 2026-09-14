export type PermissionType = 'BUTTON' | 'DATA' | 'API' | 'OTHER'

export const MenuType = {
  DIRECTORY: 'DIRECTORY',
  MENU: 'MENU'
} as const

export type MenuType = (typeof MenuType)[keyof typeof MenuType]

/** 兼容迁移前剪贴板里的 0/1 */
export const isPageMenu = (type: unknown) => type === MenuType.MENU || type === 1 || type === '1'

export const isDirectoryMenu = (type: unknown) => type === MenuType.DIRECTORY || type === 0 || type === '0'

export const normalizeMenuType = (type: unknown): MenuType => (isPageMenu(type) ? MenuType.MENU : MenuType.DIRECTORY)

export interface MenuPermission {
  id?: string
  name: string
  code: string
  type: PermissionType
  sort?: number
  enabled?: boolean
  /** 是否允许在角色授权中配置 DataScope，默认 false */
  scopeEnabled?: boolean
  menuId?: string
}

export interface MenuItem {
  id?: string
  parentId?: string | null
  type: MenuType
  name: string
  path: string
  component?: string | null
  redirect?: string | null
  title: string
  enabled?: boolean
  sort?: number
  icon?: string | null
  affix?: boolean
  activeMenu?: string | null
  alwaysShow?: boolean
  breadcrumb?: boolean
  canTo?: boolean
  hidden?: boolean
  noCache?: boolean
  noTagsView?: boolean
  external?: boolean
  link?: string | null
  keepAlive?: boolean
  permissions?: MenuPermission[]
  children?: MenuItem[]
  createdAt?: string
  updatedAt?: string
}

export type CreateMenuDto = Omit<MenuItem, 'id' | 'permissions' | 'children' | 'createdAt' | 'updatedAt'>

export type UpdateMenuDto = CreateMenuDto & { id: string }

export interface CreatePermissionDto {
  name: string
  code: string
  type: PermissionType
  menuId: string
  sort?: number
  enabled?: boolean
  scopeEnabled?: boolean
}

export interface UpdatePermissionDto {
  id: string
  name: string
  code: string
  type: PermissionType
  sort?: number
  enabled?: boolean
  scopeEnabled?: boolean
}
