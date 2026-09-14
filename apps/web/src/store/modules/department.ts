import { getDepartmentLookupApi } from '@/api/department'
import type { DepartmentItem } from '@/api/department/types'
import { defineStore } from 'pinia'

interface DepartmentState {
  list: DepartmentItem[]
  loaded: boolean
  loading: boolean
  loadError: boolean
}

let ensurePromise: Promise<DepartmentItem[]> | null = null
// loaded用于避免接口出错或返回[]时  form内部无限循环请求optionApi
export const useDepartmentStore = defineStore('department', {
  state: (): DepartmentState => ({
    list: [],
    loaded: false,
    loading: false,
    loadError: false
  }),
  actions: {
    async requestNewList() {
      this.loading = true
      this.loadError = false
      try {
        const res = await getDepartmentLookupApi()
        const { list = [], total = 0 } = res.data
        this.list = list
        this.loaded = true
        return { list, total }
      } catch (error) {
        this.loadError = true
        this.loaded = false
        throw error
      } finally {
        this.loading = false
      }
    },
    async ensureList() {
      if (this.loaded) return this.list
      if (ensurePromise) return ensurePromise

      ensurePromise = this.requestNewList()
        .then(() => this.list)
        .catch(() => {
          return this.list
        })
        .finally(() => {
          ensurePromise = null
        })

      return ensurePromise
    }
  }
})
