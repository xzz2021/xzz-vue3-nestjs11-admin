<script setup lang="tsx">
import { addDepartmentApi, delDepartmentApi, editDepartmentApi, getDepartmentListApi } from '@/api/department'
import type { DepartmentItem } from '@/api/department/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import type { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, type TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { useDepartmentStore } from '@/store/modules/department'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElMessage, ElTag } from 'element-plus'
import { reactive, ref } from 'vue'
import Write from './components/Write.vue'
import { filterDepartmentTree } from './utils/departmentTree'

const { t } = useI18n()
const departmentStore = useDepartmentStore()

/** 完整部门树缓存，搜索只在前端过滤 */
const sourceList = ref<DepartmentItem[]>([])
const searchParams = ref<Recordable>({})

const applyFilter = (list: DepartmentItem[] = sourceList.value) =>
  filterDepartmentTree(list, {
    name: searchParams.value.name,
    enabled: searchParams.value.enabled
  })

const { tableRegister, tableState, tableMethods } = useTable<DepartmentItem, string>({
  fetchDataApi: async () => {
    const res = await getDepartmentListApi()
    const list = res.data.list || []
    sourceList.value = list
    void departmentStore.requestNewList().catch(() => undefined)
    return {
      list: applyFilter(list),
      total: res.data.total || 0
    }
  },
  getRowId: (row) => row.id,
  confirmMessage: (rows) => t('department.confirmDelete', { name: rows[0].name }),
  confirmTitle: () => t('common.tip'),
  beforeDelete: (rows) => {
    if (rows.some((row) => row.children?.length)) {
      ElMessage.warning(t('department.deleteHasChildren'))
      return false
    }
  },
  deleteApi: (ids) => delDepartmentApi(ids[0])
})

const { dataList, loading } = tableState
const { getList, removeRows } = tableMethods

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'index',
    label: t('tableDemo.index'),
    type: 'index'
  },
  {
    field: 'name',
    label: t('userDemo.departmentName'),
    minWidth: 200
  },
  // {
  //   field: 'sort',
  //   label: '排序',
  //   width: 80
  // },
  {
    field: 'enabled',
    label: t('menu.status'),
    width: 100,
    slots: {
      default: (data: any) => (
        <ElTag type={data.row.enabled ? 'success' : 'danger'}>
          {data.row.enabled ? t('userDemo.enable') : t('userDemo.disable')}
        </ElTag>
      )
    }
  },
  {
    field: 'description',
    label: t('userDemo.remark'),
    minWidth: 80,
    showOverflowTooltip: true
  },
  {
    field: 'createdAt',
    label: t('tableDemo.displayTime'),
    width: 180,
    formatter: (row: DepartmentItem) => formatToDateTime(row.createdAt)
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 180,
    slots: {
      default: (data: any) => {
        const row = data.row as DepartmentItem
        return (
          <>
            <BaseButton type="primary" onClick={() => openDialog(row)}>
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
    field: 'name',
    label: t('userDemo.departmentName'),
    component: 'Input'
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

const dialogVisible = ref(false)
const dialogTitle = ref('')
const currentRow = ref<DepartmentItem | null>(null)
const writeRef = ref<InstanceType<typeof Write>>()
const saveLoading = ref(false)

const openDialog = (row?: DepartmentItem) => {
  dialogTitle.value = row ? t('exampleDemo.edit') : t('exampleDemo.add')
  currentRow.value = row ?? null
  dialogVisible.value = true
}

const handleSave = async () => {
  const formData = await writeRef.value?.submit()
  if (!formData) return

  saveLoading.value = true
  try {
    const payload = {
      name: formData.name,
      parentId: formData.parentId || null,
      enabled: formData.enabled ?? true,
      description: formData.description || undefined
    }

    if (formData.id) {
      await editDepartmentApi({ ...payload, id: formData.id })
      ElMessage.success(t('common.updateSuccess'))
    } else {
      await addDepartmentApi(payload)
      ElMessage.success(t('common.createSuccess'))
    }

    dialogVisible.value = false
    getList()
  } catch (error) {
    console.error(error)
    ElMessage.error(t('common.saveFailed'))
  } finally {
    saveLoading.value = false
  }
}
</script>

<template>
  <ContentWrap>
    <div class="mb-12px flex flex-wrap items-end gap-12px">
      <div class="min-w-0 flex-1">
        <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />
      </div>
      <BaseButton type="success" class="mb-[18px] flex-shrink-0" @click="openDialog()">
        {{ t('exampleDemo.add') }}
      </BaseButton>
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

  <Dialog v-model="dialogVisible" :title="dialogTitle" width="560px">
    <Write :key="currentRow?.id || 'new'" ref="writeRef" :current-row="currentRow" :department-list="sourceList" />

    <template #footer>
      <BaseButton @click="dialogVisible = false">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" :loading="saveLoading" @click="handleSave">
        {{ t('exampleDemo.save') }}
      </BaseButton>
    </template>
  </Dialog>
</template>
