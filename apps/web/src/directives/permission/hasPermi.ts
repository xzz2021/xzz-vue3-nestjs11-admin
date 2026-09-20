import { useI18n } from '@/hooks/web/useI18n'
import router from '@/router'
import { getRoutePermissions } from '@/utils/route-permission'
import type { App, Directive, DirectiveBinding } from 'vue'

const { t } = useI18n()

const hasPermission = (value: string): boolean => {
  const permission = getRoutePermissions(router.currentRoute.value.meta)
  // console.log('TCL: permission', permission)
  if (!value) {
    throw new Error(t('permission.hasPermission'))
  }
  if (permission.includes(value)) {
    return true
  }
  return false
}
function hasPermi(el: Element, binding: DirectiveBinding) {
  const value = binding.value

  const flag = hasPermission(value)
  if (!flag) {
    el.parentNode?.removeChild(el)
  }
}
const mounted = (el: Element, binding: DirectiveBinding<any>) => {
  hasPermi(el, binding)
}

const permiDirective: Directive = {
  mounted
}

export const setupPermissionDirective = (app: App<Element>) => {
  app.directive('hasPermi', permiDirective)
}

export default permiDirective
