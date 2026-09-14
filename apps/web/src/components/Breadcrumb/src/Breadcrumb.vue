<script lang="tsx">
import { Icon } from '@/components/Icon'
import { useDesign } from '@/hooks/web/useDesign'
import { useI18n } from '@/hooks/web/useI18n'
import { useAppStore } from '@/store/modules/app'
import { usePermissionStore } from '@/store/modules/permission'
import { ElBreadcrumb, ElBreadcrumbItem } from 'element-plus'
import { computed, defineComponent, ref, TransitionGroup, unref, watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useRouter } from 'vue-router'
import { filterBreadcrumb, getBreadcrumbRedirectPath, resolveBreadcrumbList } from './helper'

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('breadcrumb')

const appStore = useAppStore()

const breadcrumbIcon = computed(() => appStore.getBreadcrumbIcon)

export default defineComponent({
  name: 'Breadcrumb',
  setup() {
    const { currentRoute } = useRouter()
    const { t } = useI18n()
    const permissionStore = usePermissionStore()

    const breadcrumbList = ref<AppRouteRecordRaw[]>([])

    const menuRouters = computed(() => filterBreadcrumb(permissionStore.getRouters))

    const getBreadcrumb = () => {
      breadcrumbList.value = resolveBreadcrumbList(currentRoute.value, unref(menuRouters))
    }

    const renderBreadcrumb = () => {
      return unref(breadcrumbList).map((item, index) => {
        const isLast = index === unref(breadcrumbList).length - 1
        const matched = currentRoute.value.matched.find((route) => route.name === item.name)
        const redirectPath = getBreadcrumbRedirectPath(item, matched)
        const disabled = isLast || item.redirect === 'noredirect' || (!redirectPath && !item.path)
        const linkPath = disabled ? '' : redirectPath || item.path
        const meta = item.meta
        const title = t(meta?.title || '')

        return (
          <ElBreadcrumbItem to={linkPath as string} key={`${item.name || item.path}-${index}`}>
            {meta?.icon && breadcrumbIcon.value ? (
              <>
                <Icon icon={meta.icon} class="mr-[5px]"></Icon> {title}
              </>
            ) : (
              title
            )}
          </ElBreadcrumbItem>
        )
      })
    }

    watch(
      [() => currentRoute.value, () => permissionStore.getRouters],
      ([route]: [RouteLocationNormalizedLoaded, AppRouteRecordRaw[]]) => {
        if (route.path.startsWith('/redirect/')) {
          return
        }
        getBreadcrumb()
      },
      {
        immediate: true,
        deep: true
      }
    )

    return () => (
      <ElBreadcrumb separator="/" class={`${prefixCls} flex items-center h-full ml-[10px]`}>
        <TransitionGroup appear enter-active-class="animated fadeInRight">
          {renderBreadcrumb()}
        </TransitionGroup>
      </ElBreadcrumb>
    )
  }
})
</script>

<style lang="less" scoped>
@prefix-cls: ~'@{elNamespace}-breadcrumb';

.@{prefix-cls} {
  :deep(&__item) {
    display: flex;
    .@{prefix-cls}__inner {
      display: flex;
      align-items: center;
      color: var(--top-header-text-color);

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  :deep(&__item):not(:last-child) {
    .@{prefix-cls}__inner {
      color: var(--top-header-text-color);

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  :deep(&__item):last-child {
    .@{prefix-cls}__inner {
      color: var(--el-text-color-placeholder);

      &:hover {
        color: var(--el-text-color-placeholder);
      }
    }
  }
}
</style>
