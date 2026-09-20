import router from './router'
import { useAppStoreWithOut } from '@/store/modules/app'
import type { RouteRecordRaw } from 'vue-router'
import { useTitle } from '@/hooks/web/useTitle'
import { useNProgress } from '@/hooks/web/useNProgress'
import { usePermissionStoreWithOut } from '@/store/modules/permission'
import { usePageLoading } from '@/hooks/web/usePageLoading'
import { NO_REDIRECT_WHITE_LIST } from '@/constants'
import { useUserStoreWithOut } from '@/store/modules/user'
import { restoreSession } from '@/axios/session'
import { applyRoleRouters } from '@/hooks/fn/apply-role-routes'

const { start, done } = useNProgress()

const { loadStart, loadDone } = usePageLoading()

router.beforeEach(async (to, from) => {
  start()
  loadStart()
  const permissionStore = usePermissionStoreWithOut()
  const appStore = useAppStoreWithOut()
  const userStore = useUserStoreWithOut()

  if (!userStore.getToken || !userStore.getUserInfo) {
    const restored = await restoreSession()
    if (!restored) {
      if (NO_REDIRECT_WHITE_LIST.indexOf(to.path) !== -1) {
        return
      }
      return `/login?redirect=${to.path}`
    }
  }

  if (to.path === '/login') {
    return { path: '/' }
  }

  if (permissionStore.getIsAddRouters) {
    return
  }

  try {
    // 开发者可根据实际情况进行修改
    const roleRouters = userStore.getRoleRouters || []

    // 是否使用动态路由
    if (appStore.getDynamicRouter) {
      appStore.serverDynamicRouter
        ? await applyRoleRouters({
            list: roleRouters as AppCustomRouteRecordRaw[],
            generate: (items) => permissionStore.generateRoutes('server', items)
          })
        : await permissionStore.generateRoutes('frontEnd', roleRouters as string[])
    } else {
      await permissionStore.generateRoutes('static')
    }

    permissionStore.getAddRouters.forEach((route) => {
      router.addRoute(route as unknown as RouteRecordRaw) // 动态添加可访问路由表
    })
    const redirectPath = from.query.redirect || to.path
    const redirect = decodeURIComponent(redirectPath as string)
    const nextData = to.path === redirect ? { ...to, replace: true } : { path: redirect }
    permissionStore.setIsAddRouters(true)
    return nextData
  } catch {
    await userStore.abortSession()
    if (NO_REDIRECT_WHITE_LIST.indexOf(to.path) !== -1) {
      return
    }
    return `/login?redirect=${to.path}`
  }
})

router.afterEach((to) => {
  useTitle(to?.meta?.title as string)
  done() // 结束Progress
  loadDone()
})
