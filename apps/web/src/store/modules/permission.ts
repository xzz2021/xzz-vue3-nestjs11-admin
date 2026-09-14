import { asyncRouterMap, constantRouterMap } from '@/router'
import {
  flatMultiLevelRoutes,
  generateRoutesByFrontEnd,
  generateRoutesByServer,
  syncRoutesMenuToMeta
} from '@/utils/routerHelper'
import { ensureRouteTree } from '@/utils/tree'
import { cloneDeep } from 'lodash-es'
import { defineStore } from 'pinia'
import { store } from '../index'

export interface PermissionState {
  routers: AppRouteRecordRaw[]
  addRouters: AppRouteRecordRaw[]
  isAddRouters: boolean
  menuTabRouters: AppRouteRecordRaw[]
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    routers: [],
    addRouters: [],
    isAddRouters: false,
    menuTabRouters: []
  }),
  getters: {
    getRouters(): AppRouteRecordRaw[] {
      return this.routers
    },
    getAddRouters(): AppRouteRecordRaw[] {
      return flatMultiLevelRoutes(cloneDeep(this.addRouters))
    },
    getIsAddRouters(): boolean {
      return this.isAddRouters
    },
    getMenuTabRouters(): AppRouteRecordRaw[] {
      return this.menuTabRouters
    }
  },
  actions: {
    generateRoutes(
      type: 'server' | 'frontEnd' | 'static',
      routers?: AppCustomRouteRecordRaw[] | string[]
    ): Promise<unknown> {
      return new Promise<void>((resolve, reject) => {
        try {
          let routerMap: AppRouteRecordRaw[] = []
          if (type === 'server') {
            // 模拟后端过滤菜单
            routerMap = generateRoutesByServer(
              ensureRouteTree(routers as AppCustomRouteRecordRaw[]) as AppCustomRouteRecordRaw[]
            )
          } else if (type === 'frontEnd') {
            // 模拟前端过滤菜单
            routerMap = generateRoutesByFrontEnd(cloneDeep(asyncRouterMap), routers as string[])
          } else {
            // 直接读取静态路由表
            routerMap = cloneDeep(asyncRouterMap)
          }
          // 动态路由，404一定要放到最后面
          this.addRouters = syncRoutesMenuToMeta(
            routerMap.concat([
              {
                path: '/:path(.*)*',
                redirect: '/404',
                name: '404Page',
                hidden: true,
                breadcrumb: false
              }
            ])
          )
          // 渲染菜单的所有路由
          this.routers = syncRoutesMenuToMeta(cloneDeep(constantRouterMap).concat(routerMap))
          resolve()
        } catch (error) {
          reject('生成路由失败: ' + error)
        }
      })
    },
    setIsAddRouters(state: boolean): void {
      this.isAddRouters = state
    },
    setMenuTabRouters(routers: AppRouteRecordRaw[]): void {
      this.menuTabRouters = routers
    }
  },
  persist: [
    {
      pick: ['routers'],
      storage: localStorage
    },
    {
      pick: ['addRouters'],
      storage: localStorage
    },
    {
      pick: ['menuTabRouters'],
      storage: localStorage
    }
  ]
})

export const usePermissionStoreWithOut = () => {
  return usePermissionStore(store)
}
