import type { RouteRecordRaw } from 'vue-router'
import { defineComponent } from 'vue'

/**
 * 菜单/路由扩展字段（原先放在 meta 中，现直接挂在路由对象上）
 *
 * redirect: noredirect        当设置 noredirect 的时候该路由在面包屑导航中不可被点击
 * name:'router-name'          设定路由的名字，一定要填写不然使用<keep-alive>时会出现各种问题
 *
 * hidden: true              当设置 true 的时候该路由不会再侧边栏出现 如404，login等页面(默认 false)
 * alwaysShow: true          当你一个路由下面的 children 声明的路由大于1个时，自动会变成嵌套的模式，
 *                            只有一个时，会将那个子路由当做根路由显示在侧边栏，
 *                            若你想不管路由下面的 children 声明的个数都显示你的根路由，
 *                            你可以设置 alwaysShow: true，这样它就会忽略之前定义的规则，
 *                            一直显示根路由(默认 false)
 * title: 'title'            设置该路由在侧边栏和面包屑中展示的名字
 * icon: 'svg-name'          设置该路由的图标
 * noCache: true             如果设置为true，则不会被 <keep-alive> 缓存(默认 false)
 * breadcrumb: false         如果设置为false，则不会在breadcrumb面包屑中显示(默认 true)
 * affix: true               如果设置为true，则会一直固定在tag项中(默认 false)
 * noTagsView: true          如果设置为true，则不会出现在tag中(默认 false)
 * activeMenu: '/dashboard'  显示高亮的路由路径
 * canTo: true               设置为true即使hidden为true，也依然可以进行路由跳转(默认 false)
 * permissions: ['edit']     设置该路由的权限
 * external: true            设置为true时点击菜单打开 link 指向的地址，不做站内路由跳转(默认 false)
 * link: 'https://a.com'     外链地址，支持 http(s) 绝对地址与 / 开头的相对地址
 */
interface AppRouteMenu extends Record<string | number | symbol, unknown> {
  redirect?: string
  hidden?: boolean
  alwaysShow?: boolean
  title?: string
  icon?: string
  noCache?: boolean
  breadcrumb?: boolean
  affix?: boolean
  activeMenu?: string
  noTagsView?: boolean
  canTo?: boolean
  permissions?: string[]
  permission?: string[]
  followRoute?: string
  external?: boolean
  link?: string
}

declare module 'vue-router' {
  interface RouteMeta extends AppRouteMenu {}
}

type Component<T = any> =
  ReturnType<typeof defineComponent> | (() => Promise<typeof import('*.vue')>) | (() => Promise<T>)

declare global {
  interface AppRouteRecordRaw extends AppRouteMenu, Omit<RouteRecordRaw, 'children'> {
    name: string
    component?: Component | string
    children?: AppRouteRecordRaw[]
    props?: Recordable
    fullPath?: string
  }

  interface AppCustomRouteRecordRaw extends AppRouteMenu, Omit<RouteRecordRaw, 'component' | 'children'> {
    name: string
    component: string
    path: string
    redirect?: string
    children?: AppCustomRouteRecordRaw[]
    id: string
    parentId: string | null
    sort: number
    enabled: boolean
    permissions?: string[] | Recordable[]
    type: 'DIRECTORY' | 'MENU'
    keepAlive?: boolean
  }
}
