import { getRoleListApi } from '@/api/role'
import type { RoleItem } from '@/api/role/type'
import { ElMessage } from 'element-plus'
import { defineStore } from 'pinia'
const ROLE_OPTION_PAGE_SIZE = 100

interface QueryRoleParams {
  pageIndex: number
  pageSize: number
  name?: string
  code?: string
  enabled?: boolean
}
interface RoleState {
  list: RoleItem[]
  loaded: boolean
}

let ensurePromise: Promise<RoleItem[]> | null = null

export const useRoleStore = defineStore('role', {
  state: (): RoleState => ({
    list: [],
    loaded: false,
  }),
  getters: {
    options: (state) => state.list.map((role) => ({ label: role.name, value: role.id })),
  },
  actions: {
    async requestNewList(params: QueryRoleParams) {
      const res = await getRoleListApi(params)
      const { list = [], total = 0 } = res?.data || {}
      this.list = list
      // this.loaded = true

      return { list, total }
    },
    async ensureList() {
      // if (this.loaded) return this.list
      if (ensurePromise) return ensurePromise

      ensurePromise = this.requestNewList({ pageIndex: 1, pageSize: ROLE_OPTION_PAGE_SIZE })
        .then((res) => {
          if (!res?.list.length) {
            ElMessage({
              type: 'error', // 接口是通的，用 warning 比 error 更合适
              message: '暂无角色数据，请先在角色管理中创建',
              grouping: true,
            })
          }
          return this.list
        })
        .catch(async () => {
          this.list.length || setTimeout(() => ElMessage.error('角色下拉列表数据请求失败'), 3000)
          // this.list.length || ElMessage({ type: 'error', message: '角色下拉列表数据请求失败', grouping: true })
          return this.list
        })
        .finally(() => {
          // this.loaded = true
          ensurePromise = null
        })

      return ensurePromise
    },
  },
})
