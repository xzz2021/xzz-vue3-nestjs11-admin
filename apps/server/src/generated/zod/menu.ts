import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { MenuType } from "./enums"
import { CompleteRoleMenu, RelatedRoleMenuModel, CompletePermission, RelatedPermissionModel } from "./index"

export const MenuModel = z.object({
  id: z.string(),
  parentId: z.string().nullish(),
  type: z.nativeEnum(MenuType).meta({ description: 'DIRECTORY 目录 / MENU 页面', example: 'DIRECTORY' }),
  name: z.string().min(1).max(50).meta({ description: '路由名称，全局唯一，用于前端 keep-alive', example: 'User' }),
  path: z.string().min(1).max(100).meta({ description: '路由路径，全局唯一', example: 'authorization/user' }),
  component: z.string().max(100).optional().meta({ description: '前端组件路径', example: 'views/Authorization/User/User' }).nullish(),
  redirect: z.string().max(100).optional().meta({ description: '重定向路径', example: '/authorization/user' }).nullish(),
  title: z.string().min(1).max(50).meta({ description: '菜单标题，用于 i18n 展示', example: '用户管理' }),
  enabled: z.boolean().optional().meta({ description: '是否启用', example: true }),
  keepAlive: z.boolean().optional().meta({ description: '是否缓存页面', example: false }),
  sort: z.number().int().min(0).optional().meta({ description: '排序', example: 0 }),
  icon: z.string().max(50).optional().meta({ description: '菜单图标', example: 'mdi:account' }).nullish(),
  affix: z.boolean().optional().meta({ description: '是否固定标签页', example: false }),
  activeMenu: z.string().max(100).optional().meta({ description: '高亮菜单路径（隐藏子路由时指向父级）', example: '/authorization/user' }).nullish(),
  alwaysShow: z.boolean().optional().meta({ description: '是否始终显示根菜单', example: false }),
  breadcrumb: z.boolean().optional().meta({ description: '是否显示面包屑', example: true }),
  canTo: z.boolean().optional().meta({ description: '是否允许跳转', example: false }),
  hidden: z.boolean().optional().meta({ description: '是否在侧边栏隐藏', example: false }),
  noCache: z.boolean().optional().meta({ description: '是否禁用 keep-alive', example: false }),
  noTagsView: z.boolean().optional().meta({ description: '是否隐藏标签页', example: false }),
  external: z.boolean().optional().meta({ description: '是否外部链接', example: false }),
  link: z.string().max(100).regex(/^(https?:\/\/.+|\/.*)$/, { message: '外部链接格式不正确' }).optional().meta({ description: '外部链接地址，支持 http(s) 绝对地址或 / 开头的相对地址', example: 'https://example.com' }).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class MenuDto extends createZodDto(MenuModel) {
}

export interface CompleteMenu extends z.infer<typeof MenuModel> {
  parent?: CompleteMenu | null
  children: CompleteMenu[]
  roles: CompleteRoleMenu[]
  permissions: CompletePermission[]
}

/**
 * RelatedMenuModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedMenuModel: z.ZodType<CompleteMenu> = z.lazy(() => MenuModel.extend({
  parent: RelatedMenuModel.nullish(),
  children: RelatedMenuModel.array(),
  roles: RelatedRoleMenuModel.array(),
  permissions: RelatedPermissionModel.array(),
}))
