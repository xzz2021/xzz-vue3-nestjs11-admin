import { Table, type TableColumn, type TableExpose, type TableProps, type TableSetProps } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { ElMessage, ElMessageBox, ElTable } from 'element-plus'
import { nextTick, onMounted, ref, unref, watch } from 'vue'

type DeleteApiResult = boolean | string | void | unknown

export interface UseTableConfig<T extends object, Id = string> {
  /** 是否初始化的时候请求一次 */
  immediate?: boolean
  fetchDataApi?: () => Promise<{
    list: T[]
    total?: number
  }>
  getRowId?: (row: T) => Id
  deleteApi?: (ids: Id[]) => Promise<DeleteApiResult>
  emptySelectionMessage?: string | (() => string)
  confirmMessage?: string | ((rows: T[]) => string)
  confirmTitle?: string | (() => string)
  beforeDelete?: (rows: T[]) => boolean | void | Promise<boolean | void>
  afterDelete?: (ids: Id[], rows: T[]) => void | Promise<void>
}

const isCancel = (error: unknown) => error === 'cancel' || error === 'close'

const resolveMessage = <T>(value: string | ((rows: T[]) => string) | undefined, rows: T[], fallback: string) => {
  if (typeof value === 'function') return value(rows)
  return value ?? fallback
}

const resolveTitle = (value: string | (() => string) | undefined, fallback: string) => {
  if (typeof value === 'function') return value()
  return value ?? fallback
}

const interpretDeleteResult = (res: DeleteApiResult): 'fail' | 'silenced' | 'success' | { message: string } => {
  if (res === false) return 'fail'
  if (res === 'silenced') return 'silenced'
  if (typeof res === 'string') return { message: res }
  return 'success'
}

export const useTable = <T extends object, Id = string>(config: UseTableConfig<T, Id>) => {
  const { t } = useI18n()
  const { immediate = true } = config

  const loading = ref(false)
  const delLoading = ref(false)
  const currentPage = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const dataList = ref<T[]>([])
  let isPageSizeChange = false

  const getList = async () => {
    if (!config.fetchDataApi) return
    loading.value = true
    try {
      const res = await config.fetchDataApi()
      if (res) {
        dataList.value = res.list
        total.value = res.total || 0
      }
    } catch {
      // Axios interceptor already reported the error
    } finally {
      loading.value = false
    }
  }

  watch(
    () => currentPage.value,
    () => {
      if (!isPageSizeChange) getList()
      isPageSizeChange = false
    }
  )

  watch(
    () => pageSize.value,
    () => {
      if (unref(currentPage) === 1) {
        getList()
      } else {
        currentPage.value = 1
        isPageSizeChange = true
        getList()
      }
    }
  )

  onMounted(() => {
    if (immediate) {
      getList()
    }
  })

  const refreshAfterDelete = async (idsLength: number) => {
    if (!config.fetchDataApi) return
    const nextPage =
      unref(total) % unref(pageSize) === idsLength || unref(pageSize) === 1
        ? Math.max(unref(currentPage) - 1, 1)
        : unref(currentPage)

    if (nextPage !== unref(currentPage)) {
      currentPage.value = nextPage
      return
    }
    await getList()
  }

  const removeRows = async (rows: T | T[]) => {
    const list = Array.isArray(rows) ? rows : [rows]
    const { getRowId, deleteApi } = config
    if (!getRowId || !deleteApi) {
      console.warn('getRowId or deleteApi is undefined')
      return false
    }
    if (!list.length) return false

    if (config.beforeDelete) {
      const allowed = await config.beforeDelete(list)
      if (allowed === false) return false
    }

    try {
      await ElMessageBox.confirm(
        resolveMessage(config.confirmMessage, list, t('common.delMessage')),
        resolveTitle(config.confirmTitle, t('common.delWarning')),
        {
          confirmButtonText: t('common.delOk'),
          cancelButtonText: t('common.delCancel'),
          type: 'warning'
        }
      )
    } catch (error) {
      if (isCancel(error)) return false
      throw error
    }

    const ids = list.map(getRowId)
    delLoading.value = true
    try {
      const result = interpretDeleteResult(await deleteApi(ids))
      if (result === 'fail') return false
      if (result === 'success') {
        ElMessage.success(t('common.delSuccess'))
      } else if (result !== 'silenced') {
        ElMessage.success(result.message)
      }
      await config.afterDelete?.(ids, list)
      await refreshAfterDelete(ids.length)
      return true
    } catch {
      return false
    } finally {
      delLoading.value = false
    }
  }

  const tableRef = ref<(typeof Table & TableExpose) | undefined>()
  const elTableRef = ref<ComponentRef<typeof ElTable>>()

  const register = (refInstance: typeof Table & TableExpose, elRef: ComponentRef<typeof ElTable>) => {
    tableRef.value = refInstance
    elTableRef.value = unref(elRef)
  }

  const getTable = async () => {
    await nextTick()
    const table = unref(tableRef)
    if (!table) {
      console.error('The table is not registered. Please use the register method to register')
    }
    return table
  }

  const getElTableExpose = async () => {
    await getTable()
    return unref(elTableRef)
  }

  const resolveEmptySelectionMessage = () => {
    const value = config.emptySelectionMessage
    if (typeof value === 'function') return value()
    return value ?? t('common.delNoData')
  }

  const removeSelection = async () => {
    const elTableExpose = await getElTableExpose()
    const selected = (elTableExpose?.getSelectionRows() ?? []) as T[]
    if (!selected.length) {
      ElMessage.warning(resolveEmptySelectionMessage())
      return false
    }
    return removeRows(selected)
  }

  const methods = {
    getList,
    setProps: async (props: TableProps = {}) => {
      const table = await getTable()
      table?.setProps(props)
    },
    setColumn: async (columnProps: TableSetProps[]) => {
      const table = await getTable()
      table?.setColumn(columnProps)
    },
    addColumn: async (tableColumn: TableColumn, index?: number) => {
      const table = await getTable()
      table?.addColumn(tableColumn, index)
    },
    delColumn: async (field: string) => {
      const table = await getTable()
      table?.delColumn(field)
    },
    getElTableExpose,
    refresh: () => {
      getList()
    },
    removeRows,
    removeSelection
  }

  return {
    tableRegister: register,
    tableMethods: methods,
    tableState: {
      currentPage,
      pageSize,
      total,
      dataList,
      loading,
      delLoading
    }
  }
}
