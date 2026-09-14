import { pathResolve } from '@/utils/routerHelper'
import { findPath } from '@/utils/tree'
import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router'

const normalizePath = (path?: string) => {
  if (!path) return ''
  return path.replace(/\/+$/, '') || '/'
}

const isSamePath = (left?: string, right?: string) => normalizePath(left) === normalizePath(right)

export const filterBreadcrumb = (routes: AppRouteRecordRaw[], parentPath = ''): AppRouteRecordRaw[] => {
  const res: AppRouteRecordRaw[] = []

  for (const route of routes) {
    if (route.hidden && !route.canTo) {
      continue
    }

    const data: AppRouteRecordRaw = { ...route }
    data.path = pathResolve(parentPath, data.path)

    if (data.children) {
      data.children = filterBreadcrumb(data.children, data.path)
    }
    res.push(data)
  }
  return res
}

const toBreadcrumbItem = (route: Partial<AppRouteRecordRaw> & { meta?: Recordable }): AppRouteRecordRaw => {
  return {
    path: route.path ?? '',
    name: (route.name as string) ?? '',
    meta: route.meta ?? {},
    redirect: route.redirect
  } as AppRouteRecordRaw
}

const canShowInBreadcrumb = (route: { meta?: Recordable; hidden?: boolean }) => {
  const meta = route.meta ?? {}
  return !!meta.title && meta.breadcrumb !== false && !route.hidden && !meta.hidden
}

const findMenuBreadcrumbPath = (
  routers: AppRouteRecordRaw[],
  targetPath: string,
  routeName?: string | symbol | null
) => {
  const normalizedTarget = normalizePath(targetPath)

  const menuPath = findPath(routers, (node: AppRouteRecordRaw) => {
    return isSamePath(node.path, normalizedTarget) || (!!routeName && node.name === routeName)
  }) as AppRouteRecordRaw[] | null

  return menuPath?.filter((item) => canShowInBreadcrumb(item)) ?? []
}

const getMatchedBreadcrumb = (route: RouteLocationNormalizedLoaded) => {
  return route.matched
    .filter((item) => canShowInBreadcrumb(item))
    .map((item) =>
      toBreadcrumbItem({
        path: item.path,
        name: item.name as string,
        meta: item.meta,
        redirect: item.redirect as string | undefined
      })
    )
}

export const resolveBreadcrumbList = (
  route: RouteLocationNormalizedLoaded,
  routers: AppRouteRecordRaw[]
): AppRouteRecordRaw[] => {
  const rawActiveMenu = route.meta?.activeMenu as string | undefined
  // 与侧边栏一致：仅完整 path 才视为有效 activeMenu
  const activeMenu = rawActiveMenu?.startsWith('/') ? rawActiveMenu : undefined
  const targetPath = normalizePath(activeMenu || route.path)

  const menuPath = findMenuBreadcrumbPath(routers, targetPath, route.name)
  const matchedPath = getMatchedBreadcrumb(route)

  let items: AppRouteRecordRaw[] = menuPath.length >= matchedPath.length ? menuPath : matchedPath

  if (activeMenu && route.meta?.title) {
    const activePath = findMenuBreadcrumbPath(routers, activeMenu, route.name)
    if (activePath.length) {
      items = [...activePath]
    }

    if (!isSamePath(items[items.length - 1]?.path, route.path)) {
      items.push(
        toBreadcrumbItem({
          path: route.path,
          name: route.name as string,
          meta: route.meta,
          redirect: 'noredirect'
        })
      )
    }
  }

  return items.filter((item) => canShowInBreadcrumb(item))
}

export const getBreadcrumbRedirectPath = (item: AppRouteRecordRaw, matched?: RouteRecordNormalized) => {
  const redirect = item.redirect ?? matched?.redirect
  if (!redirect || redirect === 'noredirect') {
    return ''
  }
  return redirect
}
