<script setup lang="tsx">
import { delLogApi, getLogListApi } from '@/api/log/index'
import type { LogItem } from '@/api/log/type'
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

const { tableRegister, tableState, tableMethods } = useTable<LogItem, number>({
  fetchDataApi: async () => {
    const { currentPage, pageSize } = tableState
    const params = {
      pageIndex: unref(currentPage),
      pageSize: unref(pageSize),
      ...unref(searchParams)
    }
    const res = await getLogListApi(params)
    const { list, total } = res.data
    return { list, total }
  },
  getRowId: (row) => row.id,
  emptySelectionMessage: () => t('userLog.selectToDelete'),
  deleteApi: (ids) => delLogApi(ids)
})
const { loading, dataList, total, currentPage, pageSize, delLoading } = tableState
const { getList, removeRows, removeSelection } = tableMethods

const searchParams = ref<Recordable>({})
const setSearchParams = (params: Recordable) => {
  const { dateRange, ...rest } = params
  searchParams.value = { ...rest }
  if (dateRange) {
    searchParams.value.dateRange = JSON.stringify([dateRange[0].toISOString(), dateRange[1].toISOString()])
  }
  getList()
}

const formatDuration = (duration?: number) => {
  if (duration == null) return '-'
  return `${duration}ms`
}

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'selection',
    type: 'selection'
  },
  {
    field: 'index',
    label: t('tableDemo.index'),
    type: 'index'
  },
  {
    field: 'user.username',
    label: t('userLog.operator'),
    width: '100px',
    align: 'center',
    formatter: (row: LogItem) => row.user?.username || '-'
  },

  {
    field: 'isSuccess',
    label: t('userLog.result'),
    width: '90px',
    align: 'center',
    slots: {
      default: (data: any) => {
        const isSuccess = data.row.isSuccess
        return (
          <ElTag type={isSuccess ? 'success' : 'danger'}>{isSuccess ? t('common.success') : t('common.failed')}</ElTag>
        )
      }
    }
  },
  {
    field: 'responseMsg',
    label: t('userLog.responseMsg'),
    minWidth: 140,
    formatter: (row: LogItem) => row.responseMsg || '-'
  },
  {
    field: 'duration',
    label: t('userLog.duration'),
    width: '100px',
    align: 'center',
    formatter: (row: LogItem) => formatDuration(row.duration)
  },
  {
    field: 'method',
    label: t('userLog.method'),
    width: '100px',
    align: 'center'
  },
  {
    field: 'requestUrl',
    label: t('userLog.path'),
    minWidth: 180
  },
  {
    field: 'location',
    label: t('userLog.location'),
    minWidth: 160,
    formatter: (row: LogItem) => row.location || '-'
  },
  {
    field: 'createdAt',
    label: t('userLog.operateTime'),
    minWidth: 170,
    formatter: (row: LogItem) => formatToDateTime(row.createdAt)
  },
  {
    field: 'action',
    width: '200px',
    label: t('tableDemo.action'),
    fixed: 'right',
    slots: {
      default: (data: any) => {
        return (
          <>
            <BaseButton type="success" onClick={() => action(data.row, 'detail')}>
              {t('exampleDemo.detail')}
            </BaseButton>
            <BaseButton type="danger" onClick={() => removeRows(data.row)}>
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

const dialogVisible = ref(false)
const dialogTitle = ref('')

const currentRow = ref<LogItem | null>(null)
const actionType = ref('')

const action = (row: LogItem, type: string) => {
  dialogTitle.value = t(type === 'edit' ? 'exampleDemo.edit' : 'exampleDemo.detail')
  actionType.value = type
  currentRow.value = row
  dialogVisible.value = true
}

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'requestUrl',
    label: t('userLog.path'),
    component: 'Input'
  },
  {
    field: 'method',
    label: t('userLog.method'),
    component: 'Select',
    componentProps: {
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' },
        { label: 'PATCH', value: 'PATCH' }
      ]
    }
  },
  {
    field: 'isSuccess',
    label: t('userLog.result'),
    component: 'Select',
    componentProps: {
      options: [
        {
          label: t('common.success'),
          value: true
        },
        {
          label: t('common.failed'),
          value: false
        }
      ]
    }
  },
  {
    field: 'dateRange',
    label: t('userLog.operateTime'),
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

    <div class="mb-10px">
      <BaseButton :loading="delLoading" type="danger" @click="removeSelection()">
        {{ t('exampleDemo.batchDel') }}
      </BaseButton>
    </div>

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

  <Dialog v-model="dialogVisible" :title="dialogTitle">
    <Detail :current-row="currentRow" />

    <template #footer>
      <BaseButton @click="dialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
    </template>
  </Dialog>
</template>
