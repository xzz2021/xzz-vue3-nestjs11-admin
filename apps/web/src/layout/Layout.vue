<script lang="tsx">
import { computed, defineComponent, onMounted, onBeforeUnmount, unref, watch } from 'vue'
import { useAppStore } from '@/store/modules/app'
import { useOnlinePresenceStore } from '@/store/modules/onlinePresence'
import { useMessageStore } from '@/store/modules/message'
import { useUserStore } from '@/store/modules/user'
import { Backtop } from '@/components/Backtop'
import { Setting } from '@/components/Setting'
import { useRenderLayout } from './components/useRenderLayout'
import { useDesign } from '@/hooks/web/useDesign'

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('layout')

const appStore = useAppStore()
const userStore = useUserStore()
const presenceStore = useOnlinePresenceStore()
const messageStore = useMessageStore()

// 是否是移动端
const mobile = computed(() => appStore.getMobile)

// 菜单折叠
const collapse = computed(() => appStore.getCollapse)

const layout = computed(() => appStore.getLayout)

const hideSetting = computed(() => import.meta.env.VITE_HIDE_GLOBAL_SETTING === 'true')

const handleClickOutside = () => {
  appStore.setCollapse(true)
}

const renderLayout = () => {
  const { renderClassic, renderTopLeft, renderTop, renderCutMenu } = useRenderLayout()
  switch (unref(layout)) {
    case 'classic':
      return renderClassic()
    case 'topLeft':
      return renderTopLeft()
    case 'top':
      return renderTop()
    case 'cutMenu':
      return renderCutMenu()
    default:
      break
  }
}

export default defineComponent({
  name: 'Layout',
  setup() {
    onMounted(() => {
      if (userStore.getToken) {
        presenceStore.start()
        messageStore.start()
      }
    })

    watch(
      () => userStore.getToken,
      (token) => {
        if (token) {
          presenceStore.start()
          messageStore.start()
        } else {
          presenceStore.stop()
          messageStore.stop()
        }
      }
    )

    onBeforeUnmount(() => {
      presenceStore.stop()
      messageStore.stop()
    })

    return () => (
      <section class={[prefixCls, `${prefixCls}__${layout.value}`, 'w-[100%] h-[100%] relative']}>
        {mobile.value && !collapse.value ? (
          <div
            class="absolute top-0 left-0 w-full h-full opacity-30 z-99 bg-[var(--el-color-black)]"
            onClick={handleClickOutside}
          ></div>
        ) : undefined}

        {renderLayout()}

        <Backtop></Backtop>

        {!unref(hideSetting) && <Setting></Setting>}
      </section>
    )
  }
})
</script>

<style lang="less" scoped>
@prefix-cls: ~'@{adminNamespace}-layout';

.@{prefix-cls} {
  background-color: var(--app-content-bg-color);
}
</style>
