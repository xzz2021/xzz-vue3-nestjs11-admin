import { getDictionaryListApi } from '@/api/dictionary'
import type { DictionaryTypeItem } from '@/api/dictionary/types'
import { defineStore } from 'pinia'

const mapDictionaryOptions = (list: DictionaryTypeItem[]) => {
  const res: Record<string, { label: string; value: string }[]> = {}
  list.forEach((item) => {
    res[item.code] = (item.items || [])
      .filter((entry) => entry.enabled !== false)
      .map((entry) => ({
        label: entry.label,
        value: entry.value
      }))
  })
  return res
}

interface DictionaryState {
  dictionaryMap: Record<string, { label: string; value: string }[]>
  allDictionaryList: DictionaryTypeItem[]
}

export const useDictionaryStore = defineStore('dictionary', {
  state: (): DictionaryState => ({
    dictionaryMap: {},
    allDictionaryList: []
  }),
  getters: {
    getDictionaryMap: (state) => state.dictionaryMap,
    getAllDictionaryList: (state) => state.allDictionaryList
  },
  actions: {
    syncFromList(list: DictionaryTypeItem[]) {
      this.allDictionaryList = list
      this.dictionaryMap = mapDictionaryOptions(list)
    },
    async fetchDictionaryList() {
      const res = await getDictionaryListApi()
      const list = res?.data?.list || []
      this.syncFromList(list)
      return list
    }
  }
})
