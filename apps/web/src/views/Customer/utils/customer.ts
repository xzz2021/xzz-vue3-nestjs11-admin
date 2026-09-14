import type { CustomerCapability, CustomerItem, CustomerStatus } from '@/api/customer/type'
import type { DepartmentItem } from '@/api/department/types'

export const CUSTOMER_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/

export const flattenDepartments = (nodes: DepartmentItem[], result: DepartmentItem[] = []): DepartmentItem[] => {
  for (const node of nodes) {
    result.push(node)
    if (node.children?.length) flattenDepartments(node.children, result)
  }
  return result
}

export const hasCapability = (row: CustomerItem, capability: CustomerCapability): boolean => {
  return row.capabilities.includes(capability)
}

export const normalizeOptionalText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text.length ? text : null
}

export const sameOptionalText = (left: unknown, right: unknown): boolean => {
  return normalizeOptionalText(left) === normalizeOptionalText(right)
}

export const statusTagType = (status: CustomerStatus): 'info' | 'warning' | 'success' | 'danger' => {
  switch (status) {
    case 'FOLLOWING':
      return 'warning'
    case 'WON':
      return 'success'
    case 'FROZEN':
      return 'danger'
    default:
      return 'info'
  }
}
