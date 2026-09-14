export interface DepartmentItem {
  id: string
  parentId?: string | null
  name: string
  path?: string
  sort?: number
  enabled?: boolean
  description?: string | null
  children?: DepartmentItem[]
  createdAt?: string
  updatedAt?: string
}

export interface CreateDepartmentDto {
  name: string
  parentId?: string | null
  enabled?: boolean
  description?: string
}

export interface UpdateDepartmentDto extends CreateDepartmentDto {
  id: string
}
