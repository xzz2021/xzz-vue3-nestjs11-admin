<script setup lang="tsx">
import type { DepartmentItem } from '@/api/department/types'
import {
  addUserApi,
  deleteUserApi,
  downloadUserImportTemplateApi,
  exportUserApi,
  getUserByDepartmentIdApi,
  importUserApi,
  updateUserApi
} from '@/api/user'
import type { UserItem } from '@/api/user/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import type { FormSchema } from '@/components/Form'
import { hasPermi } from '@/components/Permission'
import { Search } from '@/components/Search'
import { Table, type TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { useDepartmentStore } from '@/store/modules/department'
import { useRoleStore } from '@/store/modules/role'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElDivider, ElInput, ElMessage, ElTag, ElTree } from 'element-plus'
import { computed, nextTick, onMounted, reactive, ref, unref, watch } from 'vue'
import Detail from './components/Detail.vue'
import Write from './components/Write.vue'

const { t } = useI18n()
const departmentStore = useDepartmentStore()
const roleStore = useRoleStore()
const currentNodeKey = ref('__all__')
const departmentList = computed(() => [{ id: '__all__', name: t('userDemo.all') }, ...departmentStore.list])
const searchParams = ref<Recordable>({})
const dialogVisible = ref(false)
const dialogTitle = ref('')
const actionType = ref<'add' | 'edit' | 'detail' | ''>('')
const currentRow = ref<UserItem>()
const defaultDepartmentId = ref('')
const writeRef = ref<ComponentRef<typeof Write>>()
const saveLoading = ref(false)
const exportLoading = ref(false)
const importLoading = ref(false)
const templateLoading = ref(false)
const importInputRef = ref<HTMLInputElement>()
const treeEl = ref<InstanceType<typeof ElTree>>()
const currentDepartment = ref('')

const canExport = () => hasPermi('user:export')
const canImport = () => hasPermi('user:import')

const { tableRegister, tableState, tableMethods } = useTable<UserItem, string>({
  immediate: false,
  fetchDataApi: async () => {
    const { pageSize, currentPage } = tableState
    const departmentId = unref(currentNodeKey) === '__all__' ? undefined : unref(currentNodeKey)
    const res = await getUserByDepartmentIdApi({
      ...(departmentId ? { id: departmentId } : {}),
      pageIndex: unref(currentPage),
      pageSize: unref(pageSize),
      ...unref(searchParams)
    })
    return {
      list: res.data.list || [],
      total: res.data.total || 0
    }
  },
  getRowId: (row) => row.id,
  deleteApi: (ids) => deleteUserApi(ids)
})

const { total, loading, dataList, pageSize, currentPage, delLoading } = tableState
const { getList, removeRows, removeSelection } = tableMethods

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'username',
    label: t('userDemo.username'),
    component: 'Input'
  },
  {
    field: 'phone',
    label: t('login.phone'),
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

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'selection',
    type: 'selection'
  },
  {
    field: 'index',
    label: t('userDemo.index'),
    type: 'index'
  },
  {
    field: 'username',
    label: t('userDemo.username')
  },
  {
    field: 'phone',
    label: t('login.phone')
  },
  {
    field: 'department.name',
    label: t('userDemo.department'),
    minWidth: 120
  },
  {
    field: 'roles',
    label: t('userDemo.role'),
    minWidth: 160,
    slots: {
      default: (data: any) => {
        const roles = data?.row?.roles || []
        if (!roles.length) return null
        return (
          <>
            {roles.map((role: any) => (
              <ElTag key={role.id} class="mr-4px mb-4px">
                {role.name}
              </ElTag>
            ))}
          </>
        )
      }
    }
  },
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
    field: 'createdAt',
    label: t('tableDemo.displayTime'),
    width: 180,
    formatter: (row: UserItem) => formatToDateTime(row.createdAt)
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 240,
    fixed: 'right',
    slots: {
      default: (data: any) => {
        const row = data.row as UserItem
        return (
          <>
            <BaseButton type="primary" onClick={() => openDialog(row, 'edit')}>
              {t('exampleDemo.edit')}
            </BaseButton>
            <BaseButton type="success" onClick={() => openDialog(row, 'detail')}>
              {t('exampleDemo.detail')}
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

const setSearchParams = (params: Recordable) => {
  currentPage.value = 1
  searchParams.value = params
  getList()
}

const filterNode = (value: string, data: any) => {
  if (!value || data.id === '__all__') return true
  return data.name.includes(value)
}

const currentChange = (data?: DepartmentItem) => {
  if (!data?.id) return
  currentNodeKey.value = data.id
  currentPage.value = 1
  getList()
}

const ensureRoleAndDepartmentList = async () => {
  await roleStore.ensureList()
  await departmentStore.ensureList()
  return roleStore.list.length && departmentStore.list.length
}
// 打开面板前必须先确保角色和部门下拉列表数据存在,否则会卡死
const openDialog = async (row: UserItem | undefined, type: 'add' | 'edit' | 'detail') => {
  if (!(await ensureRoleAndDepartmentList())) return
  actionType.value = type
  currentRow.value = row
  defaultDepartmentId.value = type === 'add' ? (currentNodeKey.value === '__all__' ? '' : currentNodeKey.value) : ''
  dialogTitle.value = t(
    type === 'add' ? 'exampleDemo.add' : type === 'edit' ? 'exampleDemo.edit' : 'exampleDemo.detail'
  )
  dialogVisible.value = true
}

const save = async () => {
  const formData = await unref(writeRef)?.submit()
  if (!formData) return

  saveLoading.value = true
  try {
    if ('id' in formData) {
      await updateUserApi(formData)
    } else {
      await addUserApi(formData)
    }
    dialogVisible.value = false
    getList()
  } finally {
    saveLoading.value = false
  }
}

const parseFileName = (contentDisposition?: string) => {
  if (!contentDisposition) return undefined
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])
  const match = contentDisposition.match(/filename="?([^";]+)"?/i)
  return match?.[1]
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

const handleExport = async () => {
  if (!canExport()) return
  exportLoading.value = true
  try {
    const departmentId = unref(currentNodeKey) === '__all__' ? undefined : unref(currentNodeKey)
    const response = await exportUserApi({
      ...(departmentId ? { id: departmentId } : {}),
      ...unref(searchParams)
    })
    if (response.data.type.includes('application/json')) {
      ElMessage.error(t('userDemo.exportFailed'))
      return
    }
    downloadBlob(response.data, parseFileName(response.headers['content-disposition']) || 'users.csv')
    ElMessage.success(t('userDemo.exportSuccess'))
  } catch {
    ElMessage.error(t('userDemo.exportFailed'))
  } finally {
    exportLoading.value = false
  }
}

const handleDownloadTemplate = async () => {
  if (!canImport()) return
  templateLoading.value = true
  try {
    const response = await downloadUserImportTemplateApi()
    if (response.data.type.includes('application/json')) {
      ElMessage.error(t('userDemo.importFailed'))
      return
    }
    downloadBlob(
      response.data,
      parseFileName(response.headers['content-disposition']) || 'user-import-template.csv'
    )
  } catch {
    ElMessage.error(t('userDemo.importFailed'))
  } finally {
    templateLoading.value = false
  }
}

const triggerImport = () => {
  if (!canImport()) return
  importInputRef.value?.click()
}

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    ElMessage.warning(t('userDemo.importFileRequired'))
    return
  }
  importLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await importUserApi(formData)
    const result = res.data
    ElMessage.success(
      t('userDemo.importSuccess', { success: result.success, failed: result.failed })
    )
    if (result.failed > 0 && result.errors?.length) {
      const preview = result.errors
        .slice(0, 3)
        .map((item) => `第${item.row}行: ${item.message}`)
        .join('；')
      ElMessage.warning(preview)
    }
    if (result.success > 0) getList()
  } catch {
    ElMessage.error(t('userDemo.importFailed'))
  } finally {
    importLoading.value = false
  }
}

const loadBaseData = async () => {
  await departmentStore.ensureList()
  currentNodeKey.value = '__all__'
  await nextTick()
  treeEl.value?.setCurrentKey(currentNodeKey.value)
  getList()
}

watch(currentDepartment, (value) => {
  treeEl.value?.filter(value)
})

onMounted(() => {
  loadBaseData()
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="w-250px">
      <div class="flex justify-center items-center">
        <div class="flex-1">{{ t('userDemo.departmentList') }}</div>
        <ElInput v-model="currentDepartment" class="flex-[2]" :placeholder="t('userDemo.searchDepartment')" clearable />
      </div>
      <ElDivider />
      <ElTree
        ref="treeEl"
        :data="departmentList"
        default-expand-all
        :expand-on-click-node="false"
        node-key="id"
        :current-node-key="currentNodeKey"
        :props="{ label: 'name' }"
        :filter-node-method="filterNode"
        @current-change="currentChange"
      >
        <template #default="{ data }">
          <div :title="data.name" class="whitespace-nowrap overflow-ellipsis overflow-hidden">
            {{ data.name }}
          </div>
        </template>
      </ElTree>
    </ContentWrap>

    <ContentWrap class="flex-[3] ml-20px">
      <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />

      <div class="mb-10px">
        <BaseButton type="primary" @click="openDialog(undefined, 'add')">
          {{ t('exampleDemo.add') }}
        </BaseButton>
        <BaseButton :loading="delLoading" type="danger" @click="removeSelection()">
          {{ t('exampleDemo.del') }}
        </BaseButton>
        <BaseButton v-hasPermi="'user:export'" :loading="exportLoading" @click="handleExport">
          {{ t('userDemo.export') }}
        </BaseButton>
        <BaseButton v-hasPermi="'user:import'" :loading="templateLoading" @click="handleDownloadTemplate">
          {{ t('userDemo.downloadTemplate') }}
        </BaseButton>
        <BaseButton v-hasPermi="'user:import'" :loading="importLoading" @click="triggerImport">
          {{ t('userDemo.import') }}
        </BaseButton>
        <input
          ref="importInputRef"
          type="file"
          accept=".csv,text/csv"
          class="hidden"
          @change="handleImportFile"
        />
      </div>

      <Table
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :columns="tableColumns"
        :data="dataList"
        :loading="loading"
        :pagination="{ total }"
        @register="tableRegister"
      />
    </ContentWrap>

    <Dialog v-model="dialogVisible" :title="dialogTitle">
      <Write
        v-if="actionType === 'add' || actionType === 'edit'"
        ref="writeRef"
        :current-row="currentRow"
        :default-department-id="defaultDepartmentId"
      />
      <Detail v-else-if="actionType === 'detail'" :current-row="currentRow" />

      <template #footer>
        <BaseButton
          v-if="actionType === 'add' || actionType === 'edit'"
          type="primary"
          :loading="saveLoading"
          @click="save"
        >
          {{ t('exampleDemo.save') }}
        </BaseButton>
        <BaseButton @click="dialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
      </template>
    </Dialog>
  </div>
</template>
