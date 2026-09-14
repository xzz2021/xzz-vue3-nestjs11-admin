import { ElSubMenu, ElMenuItem } from 'element-plus'
import { unref } from 'vue'
import type { RouteMeta } from 'vue-router'
import { hasOneShowingChild } from '../helper'
import { isUrl } from '@/utils/is'
import { useRenderMenuTitle } from './useRenderMenuTitle'
import { pathResolve, resolveExternalLink } from '@/utils/routerHelper'
import { useDesign } from '@/hooks/web/useDesign'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('submenu')

const { renderMenuTitle } = useRenderMenuTitle()

/** 外链菜单以绝对地址作为 index，Menu 的 select 回调据此走 window.open */
const resolveMenuIndex = (meta: RouteMeta, fallbackPath: string) => {
  if (!meta.external || typeof meta.link !== 'string') return fallbackPath
  return resolveExternalLink(meta.link) || fallbackPath
}

export const useRenderMenuItem = (menuMode) =>
  // allRouters: AppRouteRecordRaw[] = [],
  {
    const renderMenuItem = (routers: AppRouteRecordRaw[], parentPath = '/') => {
      return routers
        .filter((v) => !v.meta?.hidden)
        .map((v) => {
          const meta = v.meta ?? {}
          const { oneShowingChild, onlyOneChild } = hasOneShowingChild(v.children, v)
          const fullPath = isUrl(v.path) ? v.path : pathResolve(parentPath, v.path) // getAllParentPath<AppRouteRecordRaw>(allRouters, v.path).join('/')

          if (oneShowingChild && (!onlyOneChild?.children || onlyOneChild?.noShowingChildren) && !meta?.alwaysShow) {
            const itemMeta = onlyOneChild ? (onlyOneChild.meta ?? meta) : meta
            const itemPath = onlyOneChild ? pathResolve(fullPath, onlyOneChild.path) : fullPath
            return (
              <ElMenuItem index={resolveMenuIndex(itemMeta, itemPath)}>
                {{
                  default: () => renderMenuTitle(itemMeta)
                }}
              </ElMenuItem>
            )
          } else {
            return (
              <ElSubMenu
                index={fullPath}
                teleported
                popperClass={unref(menuMode) === 'vertical' ? `${prefixCls}-popper--vertical` : ''}
              >
                {{
                  title: () => renderMenuTitle(meta),
                  default: () => renderMenuItem(v.children!, fullPath)
                }}
              </ElSubMenu>
            )
          }
        })
    }

    return {
      renderMenuItem
    }
  }
