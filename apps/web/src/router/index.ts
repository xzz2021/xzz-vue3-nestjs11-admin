import { NO_RESET_WHITE_LIST } from '@/constants'
import { Layout, syncRoutesMenuToMeta } from '@/utils/routerHelper'
import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'

// 常量路由用于 当某些页面无法后端定义路由时，或者后端路由空,依旧需要在前端可访问的  避免踩空
export const constantRouterMap: AppRouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard/workplace',
    name: 'Root',
    hidden: true
  },

  {
    path: '/redirect',
    component: Layout,
    name: 'RedirectWrap',
    children: [
      {
        path: '/redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/views/Redirect/Redirect.vue')
      }
    ],
    hidden: true,
    noTagsView: true
  },
  {
    path: '/login',
    component: () => import('@/views/Login/Login.vue'),
    name: 'Login',
    hidden: true,
    title: 'router.login',
    noTagsView: true
  },
  {
    path: '/role',
    component: Layout,
    name: 'RoleHiddenWrap',
    hidden: true,
    canTo: true,
    children: [
      {
        path: 'assign/:id?',
        component: () => import('@/views/Authorization/Role/AssignMenuPermission.vue'),
        name: 'RoleAssignMenuPermission',
        title: 'role.assignMenuPermission',
        hidden: true,
        canTo: true,
        activeMenu: '/authorization/role',
        noCache: true
      },
      {
        path: 'detail/:id',
        component: () => import('@/views/Authorization/Role/RoleDetail.vue'),
        name: 'RoleDetail',
        title: 'role.roleDetail',
        hidden: true,
        canTo: true,
        activeMenu: '/authorization/role',
        noCache: true
      }
    ]
  },
  {
    path: '/menu',
    component: Layout,
    name: 'MenuHiddenWrap',
    hidden: true,
    canTo: true,
    children: [
      {
        path: 'edit/:id?',
        component: () => import('@/views/Authorization/Menu/MenuEdit.vue'),
        name: 'MenuEdit',
        title: 'menu.editMenu',
        hidden: true,
        canTo: true,
        activeMenu: '/authorization/menu',
        noCache: true
      }
    ]
  },
  {
    path: '/404',
    component: () => import('@/views/Error/404.vue'),
    name: 'NoFind',
    hidden: true,
    title: '404',
    noTagsView: true
  }
]

export const asyncRouterMap: AppRouteRecordRaw[] = [
  {
    path: '/dashboard',
    component: Layout,
    redirect: '/dashboard/analysis',
    name: 'Dashboard',
    title: 'router.dashboard',
    icon: 'gauge',
    alwaysShow: true,
    children: [
      {
        path: 'analysis',
        component: () => import('@/views/Dashboard/Analysis.vue'),
        name: 'Analysis',
        title: 'router.analysis',
        noCache: true,
        affix: true
      },
      {
        path: 'workplace',
        component: () => import('@/views/Dashboard/Workplace.vue'),
        name: 'Workplace',
        title: 'router.workplace',
        noCache: true
      }
    ]
  },
  {
    path: '/authorization',
    component: Layout,
    redirect: '/authorization/user',
    name: 'Authorization',
    title: 'router.authorization',
    icon: 'key',
    alwaysShow: true,
    children: [
      {
        path: 'department',
        component: () => import('@/views/Authorization/Department/Department.vue'),
        name: 'Department',
        title: 'router.department'
      },
      {
        path: 'user',
        component: () => import('@/views/Authorization/User/User.vue'),
        name: 'User',
        title: 'router.user'
      },
      {
        path: 'menu',
        component: () => import('@/views/Authorization/Menu/Menu.vue'),
        name: 'Menu',
        title: 'router.menuManagement'
      },
      {
        path: 'role',
        component: () => import('@/views/Authorization/Role/Role.vue'),
        name: 'Role',
        title: 'router.role'
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  routes: syncRoutesMenuToMeta(constantRouterMap) as RouteRecordRaw[],
  scrollBehavior: () => ({ left: 0, top: 0 })
})

export const resetRouter = (): void => {
  router.getRoutes().forEach((route) => {
    const { name } = route
    if (name && !NO_RESET_WHITE_LIST.includes(name as string)) {
      router.hasRoute(name) && router.removeRoute(name)
    }
  })
}

export const setupRouter = (app: App<Element>) => {
  app.use(router)
}

export default router
