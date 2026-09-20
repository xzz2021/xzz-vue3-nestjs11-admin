import { useI18n } from '@/hooks/web/useI18n'
import router from '@/router'
import { getRoutePermissions } from '@/utils/route-permission'

export const hasPermi = (value: string) => {
  const { t } = useI18n()
  const permission = getRoutePermissions(router.currentRoute.value.meta)
  if (!value) {
    throw new Error(t('permission.hasPermission'))
  }
  if (permission.includes(value)) {
    return true
  }
  return false
}
