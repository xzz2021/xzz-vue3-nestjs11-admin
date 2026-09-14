<script lang="tsx">
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { useAppStore } from '@/store/modules/app'
import { type ComponentSize, ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { computed, defineComponent, type PropType, ref, unref } from 'vue'
import type { TableColumn } from '../types'
import ColumnSetting from './ColumnSetting.vue'

export default defineComponent({
  name: 'TableActions',
  components: {
    ColumnSetting
  },
  props: {
    columns: {
      type: Array as PropType<TableColumn[]>,
      default: () => []
    }
  },
  emits: ['refresh', 'changSize', 'confirm'],
  setup(props, { emit }) {
    const appStore = useAppStore()
    const { t } = useI18n()
    const sizeMap = computed(() => appStore.sizeMap)
    const showSetting = ref(false)

    const refresh = () => {
      emit('refresh')
    }

    const changSize = (size: ComponentSize) => {
      emit('changSize', size)
    }

    const confirm = (columns: TableColumn[]) => {
      emit('confirm', columns)
    }

    const showColumnSetting = () => {
      showSetting.value = true
    }

    return () => (
      <>
        <div class="text-right h-28px flex items-center justify-end">
          <div title="刷新" class="w-30px h-20px flex items-center justify-end" onClick={refresh}>
            <Icon icon="refresh-cw" class="cursor-pointer" hover-color="var(--el-color-primary)" />
          </div>

          <ElDropdown trigger="click" onCommand={changSize}>
            {{
              default: () => {
                return (
                  <div title="尺寸" class="w-30px h-20px flex items-center justify-end">
                    <Icon icon="chevron-down" class="cursor-pointer" hover-color="var(--el-color-primary)" />
                  </div>
                )
              },
              dropdown: () => {
                return (
                  <ElDropdownMenu>
                    {{
                      default: () => {
                        return unref(sizeMap).map((v) => {
                          return (
                            <ElDropdownItem key={v} command={v}>
                              {t(`size.${v}`)}
                            </ElDropdownItem>
                          )
                        })
                      }
                    }}
                  </ElDropdownMenu>
                )
              }
            }}
          </ElDropdown>

          <div title="列设置" class="w-30px h-20px flex items-center justify-end" onClick={showColumnSetting}>
            <Icon icon="settings" class="cursor-pointer" hover-color="var(--el-color-primary)" />
          </div>
        </div>
        <ColumnSetting v-model={showSetting.value} columns={props.columns} onConfirm={confirm} />
      </>
    )
  }
})
</script>
