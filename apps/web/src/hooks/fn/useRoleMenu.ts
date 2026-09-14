import { getRoleMenuApi } from '@/api/login'
import { usePermissionStore } from '@/store/modules/permission'
import { useUserStore } from '@/store/modules/user'
import { ensureRouteTree } from '@/utils/tree'
import { ref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const permissionStore = usePermissionStore()

export const useRoleMenu = () => {
  const { currentRoute, addRoute, push } = useRouter()
  const redirect = ref<string>('')

  // 获取角色信息
  const getRole = async () => {
    const res = await getRoleMenuApi()
    const { list } = res?.data || {}
    if (list && list.length > 0) {
      const routers = list ? ensureRouteTree(list) : []
      userStore.setRoleRouters(routers)
      await permissionStore.generateRoutes('server', routers).catch(() => {})
      permissionStore.getAddRouters.forEach((route) => {
        addRoute(route as RouteRecordRaw) // 动态添加可访问路由表
      })
      permissionStore.setIsAddRouters(true)
      //  1. 这里正常应该跳转到来源路由, 一般首次登录来源是首页/, 从而会跳转到常量路由里定义的redirect项,如果此时路由不存在就会跳转404
      // 2. 所以开发阶段, 要么设定好常量路由第0项的redirect, 要么直接跳转已有路由的第0项 避免出错
      // 3. 最佳方案, 必须存在一个所有用户都拥有的路由欢迎页, 从而避免跳转404
      // 从当前地址栏url中提取redirect路由path   //  http://localhost:8002/#/login?redirect=/business/adminOrder
      const redirectPath = window.location.href?.split('?')[1]?.split('=')[1]
      push({ path: redirectPath || redirect.value || permissionStore.routers[0].path })
    } else {
      throw new Error('角色路由为空,请检查重试!')
    }
  }

  watch(
    () => currentRoute.value,
    (route: RouteLocationNormalizedLoaded) => {
      redirect.value = route?.query?.redirect as string
    },
    {
      immediate: true,
    },
  )
  return {
    redirect,
    getRole,
  }
}
