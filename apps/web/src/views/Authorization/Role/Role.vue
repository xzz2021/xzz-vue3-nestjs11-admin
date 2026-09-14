<script setup lang="tsx">
import { delRoleApi } from '@/api/role'
import type { RoleItem } from '@/api/role/type'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import type { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, type TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { useRoleStore } from '@/store/modules/role'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElTag } from 'element-plus'
import { onActivated, reactive, ref, unref } from 'vue'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const roleStore = useRoleStore()

const searchParams = ref<Recordable>({})

const { tableRegister, tableState, tableMethods } = useTable<RoleItem, string>({
  fetchDataApi: async () => {
    const { pageSize, currentPage } = tableState
    const res = await roleStore.requestNewList({
      pageIndex: unref(currentPage),
      pageSize: unref(pageSize),
      ...unref(searchParams),
    })
    return res
  },
  getRowId: (row) => row.id,
  deleteApi: async (ids) => {
    const result = await delRoleApi(ids[0])
    return result
  },
})

const { dataList, loading, total, currentPage, pageSize } = tableState
const { getList, removeRows } = tableMethods

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'index',
    label: t('userDemo.index'),
    type: 'index',
  },
  {
    field: 'name',
    label: t('role.roleName'),
  },
  {
    field: 'code',
    label: t('role.roleCode'),
  },

  {
    field: 'enabled',
    label: t('menu.status'),
    slots: {
      default: (data: any) => (
        <ElTag type={data.row.enabled ? 'success' : 'danger'}>
          {data.row.enabled ? t('userDemo.enable') : t('userDemo.disable')}
        </ElTag>
      ),
    },
  },
  {
    field: 'updatedAt',
    label: t('tableDemo.updatedAt'),
    formatter: (row: RoleItem) => formatToDateTime(row.updatedAt),
  },
  {
    field: 'description',
    label: t('userDemo.remark'),
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 260,
    slots: {
      default: (data: any) => {
        const row = data.row as RoleItem
        return (
          <>
            <BaseButton type="success" onClick={() => handleDetail(row)}>
              {t('exampleDemo.detail')}
            </BaseButton>
            <BaseButton disabled={row.isSystem} type="primary" onClick={() => handleEdit(row)}>
              {t('exampleDemo.edit')}
            </BaseButton>
            <BaseButton disabled={row.isSystem} type="danger" onClick={() => removeRows(row)}>
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      },
    },
  },
])

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'keyword',
    label: `${t('role.roleName')}/${t('role.roleCode')}`,
    component: 'Input',
    componentProps: {
      placeholder: t('role.roleKeywordPlaceholder'),
    },
  },
])

const setSearchParams = (data: Recordable) => {
  currentPage.value = 1
  searchParams.value = data
  getList()
}

const handleEdit = (row: RoleItem) => {
  router.push({
    name: 'RoleAssignMenuPermission',
    params: { id: row.id },
    state: {
      role: {
        id: row.id,
        name: row.name,
        code: row.code,
        enabled: row.enabled,
        description: row.description ?? '',
      },
    },
  })
}

const handleDetail = (row: RoleItem) => {
  router.push({
    name: 'RoleDetail',
    params: { id: row.id },
    state: {
      role: {
        id: row.id,
        name: row.name,
        code: row.code,
        enabled: row.enabled,
        description: row.description ?? '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        sort: row.sort,
      },
    },
  })
}

const AddAction = () => {
  router.push({ name: 'RoleAssignMenuPermission' })
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
    <div class="mb-12px flex flex-wrap items-end gap-12px">
      <div class="min-w-0 flex-1">
        <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />
      </div>
      <BaseButton type="success" class="mb-[18px] flex-shrink-0" @click="AddAction">
        {{ t('exampleDemo.add') }}
      </BaseButton>
    </div>
    <Table
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :columns="tableColumns"
      node-key="id"
      :data="dataList"
      :loading="loading"
      :pagination="{ total }"
      @register="tableRegister"
    />
  </ContentWrap>
</template>
