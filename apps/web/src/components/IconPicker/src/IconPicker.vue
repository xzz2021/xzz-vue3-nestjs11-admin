<script setup lang="ts">
import { Icon } from '@/components/Icon'
import { useDesign } from '@/hooks/web/useDesign'
import { useAppStore } from '@/store/modules/app'
import { toLucideIconName } from '@/utils/icon'
import { icons as lucideIconSet } from '@iconify-json/lucide'
import { ElInput, ElLink, ElPagination, ElPopover, ElScrollbar } from 'element-plus'
import { computed, type CSSProperties, ref, unref, watch } from 'vue'

const ALL_ICONS = Object.keys(lucideIconSet.icons).sort()

const modelValue = defineModel<string>()

const appStore = useAppStore()
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('icon-picker')

const draft = ref(modelValue.value ?? '')
const popoverVisible = ref(false)
const currentPage = ref(1)
const pageSize = ref(48)

watch(
  () => modelValue.value,
  (val) => {
    draft.value = val ?? ''
  }
)

watch(draft, () => {
  currentPage.value = 1
})

const size = computed(() => appStore.getCurrentSize)

const iconSize = computed(() => {
  return unref(size) === 'small'
    ? 'var(--el-component-size-small)'
    : unref(size) === 'large'
      ? 'var(--el-component-size-large)'
      : 'var(--el-component-size)'
})

const iconWrapStyle = computed((): CSSProperties => {
  return {
    width: unref(iconSize),
    height: unref(iconSize),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 0 0 1px var(--el-input-border-color,var(--el-border-color)) inset',
    position: 'relative',
    left: '-1px',
    cursor: 'pointer'
  }
})

const previewIcon = computed(() => toLucideIconName(draft.value))

const fuzzyMatch = (query: string, name: string): boolean => {
  const q = query.toLowerCase().trim()
  if (!q) return true
  const n = name.toLowerCase()
  if (n.includes(q)) return true
  let qi = 0
  for (const ch of n) {
    if (ch === q[qi]) qi++
    if (qi === q.length) return true
  }
  return false
}

const matchScore = (query: string, name: string): number => {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const n = name.toLowerCase()
  if (n === q) return 100
  if (n.startsWith(q)) return 80
  if (n.includes(q)) return 60
  return 20
}

const filteredIcons = computed(() => {
  const q = draft.value.trim()
  if (!q) return ALL_ICONS
  return ALL_ICONS.filter((name) => fuzzyMatch(q, name)).sort(
    (a, b) => matchScore(q, b) - matchScore(q, a) || a.localeCompare(b)
  )
})

const pageIcons = computed(() => {
  const start = (unref(currentPage) - 1) * unref(pageSize)
  return unref(filteredIcons).slice(start, start + unref(pageSize))
})

const commit = () => {
  const next = draft.value.trim() ? toLucideIconName(draft.value) : ''
  draft.value = next
  modelValue.value = next
}

const clear = () => {
  draft.value = ''
  modelValue.value = ''
  currentPage.value = 1
}

const selectIcon = (name: string) => {
  draft.value = name
  modelValue.value = name
  popoverVisible.value = false
}

/** 输入时保持面板打开（不与 click 开关冲突） */
const onInput = () => {
  popoverVisible.value = true
}
</script>

<template>
  <div :class="prefixCls" class="w-full">
    <ElPopover
      v-model:visible="popoverVisible"
      placement="bottom-start"
      :width="420"
      trigger="click"
      :show-arrow="false"
      :hide-after="0"
      popper-class="icon-picker-popper"
    >
      <!-- 输入框 + 预览图标同属 reference，避免点预览被当成外部点击而闪关 -->
      <template #reference>
        <div class="flex items-center w-full">
          <ElInput
            v-model="draft"
            clearable
            placeholder="输入关键字模糊搜索，如 user、set"
            @input="onInput"
            @clear="clear"
            @keyup.enter="commit"
            @change="commit"
          />
          <div :style="iconWrapStyle">
            <Icon v-if="previewIcon" :icon="previewIcon" />
          </div>
        </div>
      </template>

      <div class="icon-picker-panel">
        <div class="mb-8px text-12px text-[var(--el-text-color-secondary)]">
          共 {{ filteredIcons.length }} 个匹配
          <ElLink
            type="primary"
            href="https://icon-sets.iconify.design/lucide/"
            target="_blank"
            :underline="false"
            class="ml-6px align-baseline!"
          >
            Lucide 图库
          </ElLink>
        </div>

        <ElScrollbar max-height="260px">
          <div v-if="pageIcons.length" class="icon-grid">
            <button
              v-for="name in pageIcons"
              :key="name"
              type="button"
              class="icon-cell"
              :class="{ 'is-active': name === previewIcon }"
              :title="name"
              @click="selectIcon(name)"
            >
              <Icon :icon="name" :size="18" />
              <span class="icon-name">{{ name }}</span>
            </button>
          </div>
          <div v-else class="py-24px text-center text-13px text-[var(--el-text-color-secondary)]">无匹配图标</div>
        </ElScrollbar>

        <div class="mt-8px flex justify-end">
          <ElPagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            size="small"
            layout="total, prev, pager, next"
            :pager-count="5"
            :total="filteredIcons.length"
          />
        </div>
      </div>
    </ElPopover>
  </div>
</template>

<style lang="less" scoped>
@prefix-cls: ~'@{adminNamespace}-icon-picker';

.@{prefix-cls} {
  :deep(.@{elNamespace}-input__wrapper) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
}

.icon-picker-panel {
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .icon-cell {
    display: flex;
    min-height: 56px;
    padding: 6px 4px;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    transition:
      border-color 0.2s,
      color 0.2s;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;

    &:hover,
    &.is-active {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary);
    }
  }

  .icon-name {
    max-width: 100%;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.2;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-cell:hover .icon-name,
  .icon-cell.is-active .icon-name {
    color: var(--el-color-primary);
  }
}
</style>
