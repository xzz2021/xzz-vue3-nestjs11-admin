export interface QueryUserParams {
  pageIndex: number
  pageSize: number
  id?: string
  username?: string
  phone?: string
  enabled?: boolean
}

export interface UserDepartment {
  id: string
  name: string
}

export interface UserRole {
  id: string
  name: string
}
export interface UserRoleRef {
  role: UserRole
}
export interface UserItem {
  id: string
  username: string
  phone: string
  avatar?: string
  email?: string
  nickname?: string
  enabled?: boolean
  createdAt?: string
  department?: UserDepartment
  roles?: string[] | UserRole[]
}

/** 个人中心详情（含角色、部门嵌套结构） */
export interface PersonalUserDetail {
  id: string
  username: string
  phone: string
  avatar?: string
  email?: string
  nickname?: string
  createdAt?: string
  department?: UserDepartment
  roles?: UserRoleRef[]
}

export interface UpdatePersonalInfoPayload {
  id: string
  username?: string
  nickname?: string
  phone?: string
  email?: string
  avatar?: string
}

export interface UpdatePasswordPayload {
  id: string
  password: string
  newPassword: string
}

export interface CreateUserPayload {
  username: string
  phone: string
  password: string
  department: string
  roles?: string[]
  email?: string
  nickname?: string
  enabled?: boolean
  avatar?: string
}

export interface UpdateUserPayload {
  id: string
  username: string
  phone: string
  department: string
  roles?: string[]
  email?: string
  nickname?: string
  enabled?: boolean
  avatar?: string
}

export interface ResetPasswordPayload {
  id: string
  password: string
}
