<script setup lang="tsx">
import {
  addCustomerApi,
  deleteCustomerApi,
  exportCustomerApi,
  getCustomerDetailApi,
  getCustomerListApi,
  updateCustomerApi
} from '@/api/customer'
import type { CreateCustomerPayload, CustomerItem, CustomerStatus, UpdateCustomerPayload } from '@/api/customer/type'
import { CUSTOMER_STATUSES } from '@/api/customer/type'
import { getUserLookupApi } from '@/api/user'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import type { FormSchema } from '@/components/Form'
import { Icon } from '@/components/Icon'
import { hasPermi } from '@/components/Permission'
import { Search } from '@/components/Search'
import { Table, type TableColumn } from '@/components/Table'
import { useClipboard } from '@/hooks/web/useClipboard'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { useDepartmentStore } from '@/store/modules/department'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElLink, ElMessage, ElTag, ElTree } from 'element-plus'
import { computed, nextTick, onMounted, reactive, ref, unref, watch } from 'vue'
import Detail from './components/Detail.vue'
import Write from './components/Write.vue'
import { flattenDepartments, hasCapability, statusTagType } from './utils/customer'

const ALL_DEPARTMENT = '__all__'
const OWNER_PAGE_SIZE = 100

const { t } = useI18n()
const { copy } = useClipboard()
const departmentStore = useDepartmentStore()

const demoAccounts = [
  { label: '管理员 · 产品部', phone: '13012340000', password: '000000', tagType: 'danger' as const },
  { label: '普通用户 · 人事部', phone: '13012341111', password: '111111', tagType: 'info' as const }
]
const currentNodeKey = ref(ALL_DEPARTMENT)
const departmentNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const department of flattenDepartments(departmentStore.list)) {
    map.set(department.id, department.name)
  }
  return map
})
const ownerNameMap = ref(new Map<string, string>())
const searchParams = ref<Recordable>({})
const dialogVisible = ref(false)
const dialogTitle = ref('')
const actionType = ref<'add' | 'edit' | 'detail' | ''>('')
const currentRow = ref<CustomerItem>()
const defaultDepartmentId = ref('')
const writeRef = ref<ComponentRef<typeof Write>>()
const saveLoading = ref(false)
const exportLoading = ref(false)
const treeEl = ref<InstanceType<typeof ElTree>>()
const currentDepartment = ref('')

const selectedDepartmentId = computed(() =>
  unref(currentNodeKey) === ALL_DEPARTMENT ? undefined : unref(currentNodeKey)
)

const canAdd = () => hasPermi('customer:add')
const canUpdate = () => hasPermi('customer:update')
const canDelete = () => hasPermi('customer:delete')
const canDetail = () => hasPermi('customer:detail')
const canExport = () => hasPermi('customer:export')
const canAssignPermission = () => hasPermi('customer:assign')
const canUpdateSensitive = () => hasPermi('customer:sensitive-update')
const canViewSensitive = () => hasPermi('customer:sensitive-view')

const rememberOwners = (users: Array<{ id: string; username: string }>) => {
  const next = new Map(ownerNameMap.value)
  for (const user of users) {
    next.set(user.id, user.username)
  }
  ownerNameMap.value = next
}

const loadOwnersForDepartment = async (departmentId?: string) => {
  try {
    const res = await getUserLookupApi({
      ...(departmentId ? { id: departmentId } : {}),
      pageIndex: 1,
      pageSize: OWNER_PAGE_SIZE,
      enabled: true
    })
    rememberOwners(res.data.list || [])
  } catch {
    // 列表仍可展示 ownerId，拦截器已提示失败
  }
}

const { tableRegister, tableState, tableMethods } = useTable<CustomerItem, string>({
  immediate: false,
  fetchDataApi: async () => {
    const { pageSize, currentPage } = tableState
    const res = await getCustomerListApi({
      pageIndex: unref(currentPage),
      pageSize: unref(pageSize),
      departmentId: selectedDepartmentId.value,
      ...unref(searchParams)
    })
    return {
      list: res.data.list || [],
      total: res.data.total || 0
    }
  },
  getRowId: (row) => row.id,
  confirmMessage: () => t('customer.confirmDelete'),
  beforeDelete: (rows) => {
    if (rows.some((row) => !hasCapability(row, 'delete'))) {
      ElMessage.warning(t('customer.deleteCapabilityBlocked'))
      return false
    }
  },
  deleteApi: (ids) => deleteCustomerApi(ids)
})

const { total, loading, dataList, pageSize, currentPage, delLoading } = tableState
const { getList, removeRows, removeSelection } = tableMethods

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'keyword',
    label: t('customer.keyword'),
    component: 'Input'
  },
  {
    field: 'status',
    label: t('customer.statusLabel'),
    component: 'Select',
    componentProps: {
      clearable: true,
      options: CUSTOMER_STATUSES.map((status) => ({
        label: t(`customer.status.${status}`),
        value: status
      }))
    }
  }
])

const tableColumns = computed<TableColumn[]>(() => [
  {
    field: 'selection',
    type: 'selection',
    hidden: !canDelete(),
    selectable: (row: CustomerItem) => hasCapability(row, 'delete')
  },
  {
    field: 'index',
    label: t('userDemo.index'),
    type: 'index'
  },
  {
    field: 'name',
    label: t('customer.name'),
    minWidth: 140,
    showOverflowTooltip: true
  },
  {
    field: 'status',
    label: t('customer.statusLabel'),
    width: 110,
    slots: {
      default: (data: { row: CustomerItem }) => (
        <ElTag type={statusTagType(data.row.status)}>{t(`customer.status.${data.row.status}`)}</ElTag>
      )
    }
  },
  {
    field: 'dealAmount',
    label: t('customer.dealAmount'),
    width: 120
  },
  {
    field: 'internalCost',
    label: t('customer.internalCost'),
    width: 120,
    hidden: !canViewSensitive(),
    formatter: (row: CustomerItem) => row.internalCost ?? ''
  },
  {
    field: 'confidential',
    label: t('customer.confidential'),
    width: 90,
    slots: {
      default: (data: { row: CustomerItem }) => (
        <ElTag type={data.row.confidential ? 'warning' : 'info'}>
          {data.row.confidential ? t('customer.yes') : t('customer.no')}
        </ElTag>
      )
    }
  },
  {
    field: 'departmentId',
    label: t('customer.department'),
    minWidth: 120,
    formatter: (row: CustomerItem) => departmentNameMap.value.get(row.departmentId) || row.departmentId
  },
  {
    field: 'ownerId',
    label: t('customer.owner'),
    minWidth: 110,
    formatter: (row: CustomerItem) => ownerNameMap.value.get(row.ownerId) || row.ownerId
  },
  {
    field: 'updatedAt',
    label: t('customer.updatedAt'),
    width: 180,
    formatter: (row: CustomerItem) => formatToDateTime(row.updatedAt)
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 240,
    fixed: 'right',
    slots: {
      default: (data: { row: CustomerItem }) => {
        const row = data.row
        return (
          <>
            <BaseButton
              type="primary"
              disabled={!(canUpdate() && hasCapability(row, 'update'))}
              onClick={() => openDialog(row, 'edit')}
            >
              {t('exampleDemo.edit')}
            </BaseButton>
            <BaseButton
              type="success"
              disabled={!(canDetail() && hasCapability(row, 'detail'))}
              onClick={() => openDialog(row, 'detail')}
            >
              {t('exampleDemo.detail')}
            </BaseButton>
            <BaseButton
              type="danger"
              disabled={!(canDelete() && hasCapability(row, 'delete'))}
              onClick={() => removeRows(row)}
            >
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

const writeCanAssign = computed(() => canAssignPermission())

const setSearchParams = (params: Recordable) => {
  currentPage.value = 1
  const next: Recordable = {}
  if (typeof params.keyword === 'string' && params.keyword.trim()) {
    next.keyword = params.keyword.trim()
  }
  if (typeof params.status === 'string' && params.status) {
    next.status = params.status as CustomerStatus
  }
  searchParams.value = next
  getList()
}

const openDialog = async (row: CustomerItem | undefined, type: 'add' | 'edit' | 'detail') => {
  if (type === 'add' && !canAdd()) return ElMessage.error(t('customer.noPermission'))
  if (type === 'edit' && (!row || !canUpdate() || !hasCapability(row, 'update')))
    return ElMessage.error(t('customer.noPermission'))
  if (type === 'detail' && (!row || !canDetail() || !hasCapability(row, 'detail')))
    return ElMessage.error(t('customer.noPermission'))
  if (type === 'add' || type === 'edit') await departmentStore.ensureList()

  actionType.value = type
  defaultDepartmentId.value = type === 'add' && currentNodeKey.value !== ALL_DEPARTMENT ? currentNodeKey.value : ''

  if (type === 'detail' && row) {
    try {
      const res = await getCustomerDetailApi(row.id)
      currentRow.value = res.data
    } catch {
      return
    }
  } else {
    currentRow.value = row
  }

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
    if ('id' in formData && 'version' in formData) {
      await updateCustomerApi(formData as UpdateCustomerPayload)
    } else {
      await addCustomerApi(formData as CreateCustomerPayload)
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

const handleExport = async () => {
  if (!canExport()) return
  exportLoading.value = true
  try {
    const response = await exportCustomerApi({
      departmentId: selectedDepartmentId.value,
      ...unref(searchParams)
    })
    if (response.data.type.includes('application/json')) {
      ElMessage.error(t('customer.exportFailed'))
      return
    }
    const fileName = parseFileName(response.headers['content-disposition']) || 'customers.csv'
    const objectUrl = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
    ElMessage.success(t('customer.exportSuccess'))
  } catch {
    ElMessage.error(t('customer.exportFailed'))
  } finally {
    exportLoading.value = false
  }
}

const loadBaseData = async () => {
  await departmentStore.ensureList()
  currentNodeKey.value = ALL_DEPARTMENT
  await loadOwnersForDepartment()
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
    <ContentWrap class="flex-[3] ml-20px">
      <div
        class="mb-12px rounded-8px border border-[var(--el-color-primary-light-5)] bg-[var(--el-color-primary-light-9)] px-16px py-14px"
      >
        <div class="mb-8px flex items-center gap-6px text-14px font-600 text-[var(--el-text-color-primary)]">
          <Icon icon="info" :size="16" color="var(--el-color-primary)" />
          权限说明
        </div>
        <p class="m-0 mb-8px text-13px leading-22px text-[var(--el-text-color-regular)]">
          可在「角色管理」中按角色动态配置。本页列表即为当前账号可见的数据。登录不同账号即可测试效果.
        </p>
        <ol class="m-0 mb-12px list-decimal pl-18px text-13px leading-22px text-[var(--el-text-color-regular)]">
          <li>数据范围：全部 / 本部门 / 仅自己 / 部门及下级。</li>
          <li>行内操作：编辑、详情、删除会按客户状态、所属部门、是否机密等禁用, 即使强行使用后端也会校验报错。</li>
          <li>提交复核：按钮可点不代表一定成功。大额、机密、隐私等字段限制会在后端再次校验。</li>
        </ol>
        <div class="flex flex-wrap gap-8px">
          <div
            v-for="account in demoAccounts"
            :key="account.phone"
            class="flex flex-wrap items-center gap-8px rounded-6px bg-[var(--el-bg-color)] px-12px py-8px"
          >
            <ElTag size="small" :type="account.tagType" effect="plain">{{ account.label }}</ElTag>
            <ElLink type="primary" underline="never" title="点击复制手机号" @click="copy(account.phone)">
              <span class="inline-flex items-center gap-4px font-mono">
                {{ account.phone }}
                <Icon icon="copy" :size="13" />
              </span>
            </ElLink>
            <span class="text-13px text-[var(--el-text-color-secondary)]">密码 {{ account.password }}</span>
          </div>
        </div>
      </div>
      <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />

      <div class="mb-10px">
        <BaseButton v-hasPermi="'customer:add'" type="primary" @click="openDialog(undefined, 'add')">
          {{ t('exampleDemo.add') }}
        </BaseButton>
        <BaseButton v-hasPermi="'customer:delete'" :loading="delLoading" type="danger" @click="removeSelection()">
          {{ t('exampleDemo.batchDel') }}
        </BaseButton>
        <BaseButton v-hasPermi="'customer:export'" :loading="exportLoading" @click="handleExport">
          {{ t('customer.export') }}
        </BaseButton>
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
        :can-assign="writeCanAssign"
        :can-update-sensitive="canUpdateSensitive()"
      />
      <Detail
        v-else-if="actionType === 'detail'"
        :current-row="currentRow"
        :department-name="currentRow ? departmentNameMap.get(currentRow.departmentId) || '' : ''"
        :owner-name="currentRow ? ownerNameMap.get(currentRow.ownerId) || '' : ''"
      />

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
