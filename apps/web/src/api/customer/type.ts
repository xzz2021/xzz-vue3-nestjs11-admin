export const CUSTOMER_STATUSES = ['LEAD', 'FOLLOWING', 'WON', 'FROZEN'] as const

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export type CustomerCapability = 'update' | 'delete' | 'detail'

export interface CustomerItem {
  id: string
  name: string
  phone: string | null
  remark: string | null
  status: CustomerStatus
  dealAmount: string
  internalCost?: string
  confidential: boolean
  ownerId: string
  departmentId: string
  createdById: string
  version: number
  createdAt: string
  updatedAt: string
  capabilities: CustomerCapability[]
}

export interface CustomerListResult {
  list: CustomerItem[]
  total: number
  pageIndex: number
  pageSize: number
}

export interface QueryCustomerParams {
  pageIndex: number
  pageSize: number
  keyword?: string
  status?: CustomerStatus
  departmentId?: string
}

export interface ExportCustomerParams {
  keyword?: string
  status?: CustomerStatus
  departmentId?: string
}

export interface CreateCustomerPayload {
  name: string
  phone?: string | null
  remark?: string | null
  status?: CustomerStatus
  dealAmount?: string
  internalCost?: string
  confidential?: boolean
  ownerId?: string
  departmentId?: string
}

export interface UpdateCustomerPayload {
  id: string
  version: number
  name?: string
  phone?: string | null
  remark?: string | null
  status?: CustomerStatus
  dealAmount?: string
  internalCost?: string
  confidential?: boolean
  ownerId?: string
  departmentId?: string
}
