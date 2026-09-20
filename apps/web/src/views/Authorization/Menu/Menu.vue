<script setup lang="tsx">
import { delMenuApi, getMenuListApi, sortMenuApi } from '@/api/menu'
import type { MenuItem } from '@/api/menu/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import type { FormSchema } from '@/components/Form'
import { Icon } from '@/components/Icon'
import { Search } from '@/components/Search'
import { Table, type TableColumn } from '@/components/Table'
import { useRoleMenu } from '@/hooks/fn/useRoleMenu'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { ElMessage, ElTag } from 'element-plus'
import { cloneDeep } from 'lodash-es'
import { onActivated, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import SortMenu from './components/SortMenu.vue'
import { filterMenuTree } from './utils/menuTree'
const { t } = useI18n()
const router = useRouter()
const { getRole } = useRoleMenu()
const refreshRole = async () => {
  try {
    await getRole()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t('common.refresh'))
  }
}
/** 完整菜单树缓存，搜索只在前端过滤 */
const sourceList = ref<MenuItem[]>([])
const searchParams = ref<Recordable>({})

const applyFilter = (list: MenuItem[] = sourceList.value) =>
  filterMenuTree(
    list,
    {
      keyword: searchParams.value.title,
      enabled: searchParams.value.enabled
    },
    (node) => t(node.title)
  )

const { tableRegister, tableState, tableMethods } = useTable<MenuItem, string>({
  fetchDataApi: async () => {
    const res = await getMenuListApi()
    sourceList.value = res.data.list || []
    return {
      list: applyFilter(sourceList.value)
    }
  },
  getRowId: (row) => row.id ?? '',
  confirmMessage: () => t('menu.confirmDelete'),
  confirmTitle: () => t('common.tip'),
  beforeDelete: (rows) => {
    if (rows.some((row) => !row.id)) return false
    if (rows.some((row) => row.children?.length)) {
      ElMessage.warning(t('menu.deleteHasChildren'))
      return false
    }
  },
  deleteApi: (ids) => delMenuApi(ids[0])
})

const { dataList, loading } = tableState
const { getList, removeRows } = tableMethods

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'index',
    label: t('userDemo.index'),
    align: 'center',
    type: 'index'
  },
  {
    field: 'title',
    label: t('menu.name'),
    slots: {
      default: (data: any) => {
        const title = data.row.title
        return <>{t(title)}</>
      }
    }
  },
  {
    field: 'icon',
    label: t('menu.icon'),
    width: 60,
    align: 'center',
    slots: {
      default: (data: any) => {
        const icon = data.row.icon
        return icon ? <Icon icon={icon} /> : null
      }
    }
  },
  {
    field: 'component',
    label: t('menu.component'),
    slots: {
      default: (data: any) => {
        const component = data.row.component
        return (
          <>{component === '#' ? t('menu.topDirectory') : component === '##' ? t('menu.subDirectory') : component}</>
        )
      }
    }
  },
  {
    field: 'path',
    label: t('menu.path')
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    width: 80,
    slots: {
      default: (data: any) => {
        return (
          <ElTag type={data.row.enabled ? 'success' : 'danger'}>
            {data.row.enabled ? t('userDemo.enable') : t('userDemo.disable')}
          </ElTag>
        )
      }
    }
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 180,
    slots: {
      default: (data: any) => {
        const row = data.row
        return (
          <>
            <BaseButton type="primary" onClick={() => handleEdit(row)}>
              {t('exampleDemo.edit')}
            </BaseButton>
            <BaseButton type="danger" onClick={() => removeRows(row)}>
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'title',
    label: t('menu.name'),
    component: 'Input',
    componentProps: {
      placeholder: t('menu.namePlaceholder')
    }
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    component: 'Select',
    componentProps: {
      options: [
        { label: t('userDemo.enable'), value: true },
        { label: t('userDemo.disable'), value: false }
      ]
    }
  }
])

const setSearchParams = (data: Recordable) => {
  searchParams.value = data
  dataList.value = applyFilter()
}

const handleEdit = (row: MenuItem) => {
  router.push({
    name: 'MenuEdit',
    params: { id: row.id! },
    state: { menu: cloneDeep(row) as any }
  })
}

const AddAction = () => {
  router.push({ name: 'MenuEdit' })
}

const sortDialogVisible = ref(false)
const sortLoading = ref(false)
const sortMenuRef = ref<InstanceType<typeof SortMenu>>()

const openSortDialog = () => {
  if (!sourceList.value.length) {
    ElMessage.warning(t('menu.noMenuToSort'))
    return
  }
  sortDialogVisible.value = true
}

const handleSortSave = async () => {
  const payload = sortMenuRef.value?.getSortData() ?? []
  if (!payload.length) {
    ElMessage.warning(t('menu.noMenuToSort'))
    return
  }
  sortLoading.value = true
  try {
    await sortMenuApi(payload)
    ElMessage.success(t('menu.sortSuccess'))
    sortDialogVisible.value = false
    getList()
  } catch (error) {
    console.error(error)
  } finally {
    sortLoading.value = false
  }
}

onActivated(() => {
  if (history.state?.refresh) {
    getList()
    history.replaceState({ ...history.state, refresh: false }, '')
  }
})
</script>

<template>
  <ContentWrap>
    <div class="flex flex-wrap items-end gap-12px">
      <div class="min-w-0 flex-1">
        <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />
      </div>
      <div>
        <BaseButton type="success" class="mb-[18px] flex-shrink-0" @click="AddAction">
          {{ t('exampleDemo.add') }}
        </BaseButton>
        <BaseButton type="primary" class="mb-[18px] flex-shrink-0" @click="openSortDialog">
          {{ t('menu.sort') }}
        </BaseButton>
        <BaseButton type="danger" class="mb-[18px] flex-shrink-0" @click="refreshRole">{{
          t('common.refresh')
        }}</BaseButton>
      </div>
    </div>
    <Table
      :columns="tableColumns"
      default-expand-all
      node-key="id"
      :data="dataList"
      :loading="loading"
      @register="tableRegister"
    />
  </ContentWrap>

  <Dialog v-model="sortDialogVisible" :title="t('menu.sort')" width="560px" :max-height="480">
    <SortMenu v-if="sortDialogVisible" ref="sortMenuRef" :menu-list="sourceList" />
    <template #footer>
      <BaseButton @click="sortDialogVisible = false">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" :loading="sortLoading" @click="handleSortSave">
        {{ t('exampleDemo.save') }}
      </BaseButton>
    </template>
  </Dialog>
</template>
