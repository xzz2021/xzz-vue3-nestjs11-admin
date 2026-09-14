import { isUrl } from '@/utils/is'
import { cloneDeep, omit, pick } from 'lodash-es'
import type { RouteLocationNormalized, Router, RouteRecordNormalized, RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 动态路由组件映射。
 * 排除 Components 演示页：含 xgplayer 等重型 demo，
 * 会被 Rollup 全量 transform，显著抬高构建内存与耗时。
 * 业务菜单不应指向 views/Components/**；若需本地预览演示页，请用显式 import 或临时去掉排除项。
 */
const modules = import.meta.glob(['../views/**/*.{vue,tsx}', '!../views/Components/**'])

const ROUTE_MENU_META_KEYS = [
  'hidden',
  'alwaysShow',
  'title',
  'icon',
  'noCache',
  'breadcrumb',
  'affix',
  'activeMenu',
  'noTagsView',
  'canTo',
  'permissions',
  'permission',
  'external',
  'link'
] as const

/** activeMenu 仅接受完整路由 path，用于隐藏子页高亮父菜单；过滤种子/脏数据中的无效值 */
const normalizeActiveMenu = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.startsWith('/') ? trimmed : undefined
}

const extractRouteMenuFields = (route: AppRouteRecordRaw): Recordable => {
  const fromMeta = pick(route.meta ?? {}, ROUTE_MENU_META_KEYS)
  const fromRoute = pick(route, ROUTE_MENU_META_KEYS)
  const merged: Recordable = { ...fromMeta, ...fromRoute }
  const activeMenu = normalizeActiveMenu(merged.activeMenu)
  if (activeMenu) {
    merged.activeMenu = activeMenu
  } else {
    delete merged.activeMenu
  }
  return merged
}

/** 将路由顶层的菜单字段同步到 meta，供 vue-router 运行时组件读取 */
export const syncRouteMenuToMeta = (route: AppRouteRecordRaw): AppRouteRecordRaw => {
  const menuFields = extractRouteMenuFields(route)
  const synced: AppRouteRecordRaw = {
    ...route,
    ...menuFields,
    // 显式覆盖，避免 ...route / ...meta 残留无效 activeMenu（如种子占位 'fff'）
    activeMenu: menuFields.activeMenu,
    meta: {
      ...(route.meta ?? {}),
      ...menuFields,
      activeMenu: menuFields.activeMenu
    }
  }

  if (!menuFields.activeMenu) {
    delete synced.activeMenu
    delete synced.meta?.activeMenu
  }

  if (synced.children?.length) {
    synced.children = synced.children.map((child) => syncRouteMenuToMeta(child))
  }

  return synced
}

export const syncRoutesMenuToMeta = (routes: AppRouteRecordRaw[]): AppRouteRecordRaw[] => {
  return routes.map((route) => syncRouteMenuToMeta(route))
}

/* Layout */
export const Layout = () => import('@/layout/Layout.vue')

export const getParentLayout = () => {
  return () =>
    new Promise((resolve) => {
      resolve({
        name: 'ParentLayout'
      })
    })
}

export const getRawRoute = (route: RouteLocationNormalized): RouteLocationNormalized => {
  if (!route) return route
  const { matched, ...opt } = route
  return {
    ...opt,
    matched: (matched
      ? matched.map((item) => ({
          name: item.name,
          path: item.path
        }))
      : undefined) as RouteRecordNormalized[]
  }
}

// 前端控制路由生成
export const generateRoutesByFrontEnd = (
  routes: AppRouteRecordRaw[],
  keys: string[],
  basePath = '/'
): AppRouteRecordRaw[] => {
  const res: AppRouteRecordRaw[] = []

  for (const route of routes) {
    // skip some route
    if (route.hidden && !route.canTo) {
      continue
    }

    let data: Nullable<AppRouteRecordRaw> = null

    let onlyOneChild: Nullable<string> = null
    if (route.children && route.children.length === 1 && !route.alwaysShow) {
      onlyOneChild = (
        isUrl(route.children[0].path)
          ? route.children[0].path
          : pathResolve(pathResolve(basePath, route.path), route.children[0].path)
      ) as string
    }

    // 开发者可以根据实际情况进行扩展
    for (const item of keys) {
      // 通过路径去匹配
      if (isUrl(item) && (onlyOneChild === item || route.path === item)) {
        data = Object.assign({}, route)
      } else {
        const routePath = (onlyOneChild ?? pathResolve(basePath, route.path)).trim()
        if (routePath === item || route.followRoute === item) {
          data = Object.assign({}, route)
        }
      }
    }

    // recursive child routes
    if (route.children && data) {
      data.children = generateRoutesByFrontEnd(route.children, keys, pathResolve(basePath, data.path))
    }
    if (data) {
      res.push(syncRouteMenuToMeta(data as AppRouteRecordRaw))
    }
  }
  return res
}

// 按当前树位置补全路径：根节点必须是绝对路径，子节点保持相对段。
// 不能用 parentId 判断——父级未出现在本次 payload 时，子节点会被提到树根。
export const normalizeServerRoutePath = (path: string, nested: boolean) => {
  if (isUrl(path)) return path
  const trimmed = path.trim()
  if (nested) {
    return trimmed.replace(/^\/+/, '')
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

const isShellComponent = (component?: string) => !!component && (component === '#' || component.includes('##'))

// 树根上的页面菜单没有目录 Layout，提到一级后需要包一层才能保留侧栏/顶栏。
export const shouldWrapRootPageWithLayout = (route: AppCustomRouteRecordRaw, nested: boolean) => {
  if (nested || route.external || isUrl(route.path) || !route.component) return false
  return !isShellComponent(route.component)
}

export const wrapRootPageWithLayout = (page: AppRouteRecordRaw): AppRouteRecordRaw => {
  const { children = [], ...pageRoute } = page
  return {
    path: page.path,
    component: Layout,
    name: `${String(page.name)}Layout`,
    hidden: page.hidden,
    alwaysShow: false,
    breadcrumb: false,
    children: [
      {
        ...pageRoute,
        path: ''
      },
      ...children
    ]
  }
}

// 后端控制路由生成
export const generateRoutesByServer = (routes: AppCustomRouteRecordRaw[], nested = false): AppRouteRecordRaw[] => {
  const res: AppRouteRecordRaw[] = []

  for (const route of routes) {
    const { path, ...rest } = route
    const data = {
      path: normalizeServerRoutePath(path, nested),
      ...rest
    } as AppRouteRecordRaw
    if (route.component) {
      const comModule = modules[`../${route.component}.vue`] || modules[`../${route.component}.tsx`]
      const component = route.component as string
      if (!comModule && !component.includes('#')) {
        // 外链菜单不渲染本地页面，component 只是占位，无需告警
        if (!route.external) {
          console.error(`未找到${route.component}.vue文件或${route.component}.tsx文件，请创建`)
        }
      } else {
        // 动态加载路由文件，可根据实际情况进行自定义逻辑
        data.component = component === '#' ? Layout : component.includes('##') ? getParentLayout() : comModule
      }
    }
    // recursive child routes
    if (route.children) {
      data.children = generateRoutesByServer(route.children, true)
    }
    const record = shouldWrapRootPageWithLayout(route, nested) ? wrapRootPageWithLayout(data) : data
    res.push(syncRouteMenuToMeta(record))
  }
  return res
}

/**
 * 外链地址归一化为绝对地址：http(s) 原样返回，相对地址按站点根补全。
 * 归一化后可直接交给 Menu 的 select 回调，由既有的 isUrl 分支走 window.open。
 */
export const resolveExternalLink = (link: string): string => {
  const trimmed = link.trim()
  if (!trimmed) return ''
  if (isUrl(trimmed)) return trimmed
  try {
    return new URL(trimmed, window.location.origin).href
  } catch (_error) {
    return ''
  }
}

export const pathResolve = (parentPath: string, path: string) => {
  if (isUrl(path)) return path
  const childPath = path.startsWith('/') || !path ? path : `/${path}`
  return `${parentPath}${childPath}`.replace(/\/\//g, '/').trim()
}

// 路由降级
export const flatMultiLevelRoutes = (routes: AppRouteRecordRaw[]) => {
  const modules: AppRouteRecordRaw[] = cloneDeep(routes)
  for (let index = 0; index < modules.length; index++) {
    const route = modules[index]
    if (!isMultipleRoute(route)) {
      continue
    }
    promoteRouteLevel(route)
  }
  return syncRoutesMenuToMeta(modules)
}

// 层级是否大于2
const isMultipleRoute = (route: AppRouteRecordRaw) => {
  if (!route || !Reflect.has(route, 'children') || !route.children?.length) {
    return false
  }

  const children = route.children

  let flag = false
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (child.children?.length) {
      flag = true
      break
    }
  }
  return flag
}

// 生成二级路由
const promoteRouteLevel = (route: AppRouteRecordRaw) => {
  let router: Router | null = createRouter({
    routes: [route as RouteRecordRaw],
    history: createWebHashHistory()
  })

  const routes = router.getRoutes()
  addToChildren(routes, route.children || [], route)
  router = null

  route.children = route.children?.map((item) => omit(item, 'children') as AppRouteRecordRaw)
}

// 添加所有子菜单
const addToChildren = (
  routes: RouteRecordNormalized[],
  children: AppRouteRecordRaw[],
  routeModule: AppRouteRecordRaw
) => {
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    const route = routes.find((item) => item.name === child.name)
    if (!route) {
      continue
    }
    routeModule.children = routeModule.children || []
    if (!routeModule.children.find((item) => item.name === route.name)) {
      routeModule.children?.push(route as unknown as AppRouteRecordRaw)
    }
    if (child.children?.length) {
      addToChildren(routes, child.children, routeModule)
    }
  }
}
