<script setup lang="tsx">
import { getAuditLogListApi } from '@/api/log/index'
import type { AuditLogItem } from '@/api/log/type'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import type { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, type TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElTag } from 'element-plus'
import { reactive, ref, unref } from 'vue'
import Detail from './components/Detail.vue'

const { t } = useI18n()

const actionOptions = [
  'auth.login',
  'auth.login_failed',
  'auth.lockout',
  'auth.logout',
  'auth.force_logout',
  'auth.register',
  'user.create',
  'user.update',
  'user.delete',
  'user.reset_password',
  'user.update_password',
  'user.update_profile',
  'role.create',
  'role.update',
  'role.delete',
  'menu.create',
  'menu.update',
  'menu.delete',
  'department.create',
  'department.update',
  'department.delete'
].map((value) => ({
  label: t(`auditLog.actions.${value}`),
  value
}))

const actionLabel = (action: string) => {
  const key = `auditLog.actions.${action}`
  const label = t(key)
  return label === key ? action : label
}

const { tableRegister, tableState, tableMethods } = useTable<AuditLogItem, string>({
  fetchDataApi: async () => {
    const { currentPage, pageSize } = tableState
    const params = {
      pageIndex: unref(currentPage),
      pageSize: unref(pageSize),
      ...unref(searchParams)
    }
    const res = await getAuditLogListApi(params)
    const { list, total } = res.data
    return { list, total }
  },
  getRowId: (row) => row.id
})
const { loading, dataList, total, currentPage, pageSize } = tableState
const { getList } = tableMethods

const searchParams = ref<Recordable>({})
const setSearchParams = (params: Recordable) => {
  const { dateRange, ...rest } = params
  searchParams.value = { ...rest }
  if (dateRange) {
    searchParams.value.dateRange = JSON.stringify([dateRange[0].toISOString(), dateRange[1].toISOString()])
  }
  getList()
}

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'user.username',
    label: t('auditLog.operator'),
    minWidth: 120,
    formatter: (row: AuditLogItem) => row.user?.username || '-'
  },
  {
    field: 'action',
    label: t('auditLog.action'),
    minWidth: 150,
    formatter: (row: AuditLogItem) => actionLabel(row.action)
  },
  {
    field: 'resource',
    label: t('auditLog.resource'),
    width: '120px'
  },
  {
    field: 'resourceId',
    label: t('auditLog.resourceId'),
    minWidth: 140,
    formatter: (row: AuditLogItem) => row.resourceId || '-'
  },
  {
    field: 'success',
    label: t('auditLog.result'),
    width: '90px',
    align: 'center',
    slots: {
      default: (data: { row: AuditLogItem }) => {
        const success = data.row.success
        return <ElTag type={success ? 'success' : 'danger'}>{success ? t('common.success') : t('common.failed')}</ElTag>
      }
    }
  },
  {
    field: 'location',
    label: t('auditLog.location'),
    minWidth: 160,
    formatter: (row: AuditLogItem) => row.location || '-'
  },
  {
    field: 'createdAt',
    label: t('auditLog.operateTime'),
    minWidth: 170,
    formatter: (row: AuditLogItem) => formatToDateTime(row.createdAt)
  },
  {
    field: 'detail',
    width: '120px',
    label: t('tableDemo.action'),
    fixed: 'right',
    slots: {
      default: (data: { row: AuditLogItem }) => {
        return (
          <BaseButton type="success" onClick={() => action(data.row)}>
            {t('exampleDemo.detail')}
          </BaseButton>
        )
      }
    }
  }
])

const dialogVisible = ref(false)
const currentRow = ref<AuditLogItem | null>(null)

const action = (row: AuditLogItem) => {
  currentRow.value = row
  dialogVisible.value = true
}

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'action',
    label: t('auditLog.action'),
    component: 'Select',
    componentProps: {
      options: actionOptions,
      filterable: true,
      clearable: true
    }
  },
  {
    field: 'resource',
    label: t('auditLog.resource'),
    component: 'Select',
    componentProps: {
      options: [
        { label: 'Auth', value: 'Auth' },
        { label: 'User', value: 'User' },
        { label: 'Role', value: 'Role' },
        { label: 'Menu', value: 'Menu' },
        { label: 'Department', value: 'Department' }
      ]
    }
  },
  {
    field: 'success',
    label: t('auditLog.result'),
    component: 'Select',
    componentProps: {
      options: [
        { label: t('common.success'), value: true },
        { label: t('common.failed'), value: false }
      ]
    }
  },
  {
    field: 'dateRange',
    label: t('auditLog.operateTime'),
    component: 'DatePicker',
    componentProps: {
      type: 'datetimerange',
      format: 'YYYY-MM-DD HH:mm:ss',
      disabledDate: (time: Date) => {
        return time.getTime() > Date.now() + 1000 * 60 * 60 * 24
      }
    }
  }
])
</script>

<template>
  <ContentWrap>
    <Search :schema="searchSchema" @search="setSearchParams" @reset="setSearchParams" />

    <Table
      v-model:pageSize="pageSize"
      v-model:currentPage="currentPage"
      :columns="tableColumns"
      :data="dataList"
      :loading="loading"
      :pagination="{
        total: total
      }"
      @register="tableRegister"
    />
  </ContentWrap>

  <Dialog v-model="dialogVisible" :title="t('exampleDemo.detail')">
    <Detail :current-row="currentRow" />

    <template #footer>
      <BaseButton @click="dialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
    </template>
  </Dialog>
</template>
