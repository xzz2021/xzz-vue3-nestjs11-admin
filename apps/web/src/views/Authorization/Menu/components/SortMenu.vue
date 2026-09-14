<template>
  <div>
    <p class="mb-12px text-14px text-[var(--el-text-color-secondary)]">
      {{ t('menu.sortTip') }}
    </p>
    <ElTree
      :data="treeData"
      draggable
      default-expand-all
      node-key="id"
      :props="treeProps"
      :allow-drop="allowDrop"
      :allow-drag="allowDrag"
      @node-drag-end="handleDragEnd"
    />
  </div>
</template>

<script lang="ts" setup>
import type { MenuItem } from '@/api/menu/types'
import { useI18n } from '@/hooks/web/useI18n'
import { ElTree } from 'element-plus'
import type Node from 'element-plus/es/components/tree/src/model/node'
import type { AllowDropType } from 'element-plus/es/components/tree/src/tree.type'
import { cloneDeep } from 'lodash-es'
import { ref, watch } from 'vue'

export type MenuSortItem = { id: string; sort: number }

const props = defineProps<{
  menuList: MenuItem[]
}>()

const { t } = useI18n()

const treeData = ref<MenuItem[]>([])
const updateData = ref<MenuSortItem[]>([])

const treeProps = {
  label: (data: MenuItem) => t(data.title),
  children: 'children'
}

const flattenSort = (list: MenuItem[], result: MenuSortItem[] = []): MenuSortItem[] => {
  list.forEach((item, index) => {
    if (item.id) {
      result.push({ id: item.id, sort: index })
    }
    if (item.children?.length) {
      flattenSort(item.children, result)
    }
  })
  return result
}

const syncSortData = () => {
  updateData.value = flattenSort(treeData.value)
}

watch(
  () => props.menuList,
  (list) => {
    treeData.value = cloneDeep(list || [])
    syncSortData()
  },
  { immediate: true, deep: true }
)

const handleDragEnd = () => {
  syncSortData()
}

/** 仅允许同级兄弟节点之间前后排序，禁止拖入成为子节点 */
const allowDrop = (draggingNode: Node, dropNode: Node, type: AllowDropType) => {
  if (draggingNode.data.parentId === dropNode.data.parentId) {
    return type !== 'inner'
  }
  return false
}

const allowDrag = () => true

const getSortData = () => updateData.value

defineExpose({
  getSortData
})
</script>
