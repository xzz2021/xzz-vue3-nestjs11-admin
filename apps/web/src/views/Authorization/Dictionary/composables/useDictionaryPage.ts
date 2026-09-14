import { getDictionaryListApi } from '@/api/dictionary'
import type { DictionaryEntryItem, DictionaryTypeItem } from '@/api/dictionary/types'
import { useDictionaryStore } from '@/store/modules/dictionary'
import { computed, ref } from 'vue'
import { filterDictionaryEntries } from '../utils/dictionary'

export const useDictionaryPage = () => {
  const dictionaryStore = useDictionaryStore()

  const dictionaryList = ref<DictionaryTypeItem[]>([])
  const listLoading = ref(false)
  const currentTypeId = ref<string>()
  const entryKeyword = ref('')

  const currentType = computed(() => dictionaryList.value.find((item) => item.id === currentTypeId.value))

  const currentTypeCode = computed(() => currentType.value?.code || '')

  const entryList = computed(() => filterDictionaryEntries(currentType.value?.items || [], entryKeyword.value))

  const refreshList = async (selectTypeId?: string) => {
    listLoading.value = true
    try {
      const res = await getDictionaryListApi()
      dictionaryList.value = res.data.list || []
      dictionaryStore.syncFromList(dictionaryList.value)

      if (!dictionaryList.value.length) {
        currentTypeId.value = undefined
        return
      }

      const preferredId = selectTypeId ?? currentTypeId.value
      const exists = dictionaryList.value.some((item) => item.id === preferredId)
      currentTypeId.value = exists ? preferredId : dictionaryList.value[0].id
    } finally {
      listLoading.value = false
    }
  }

  const selectType = (id: string) => {
    currentTypeId.value = id
  }

  const setEntryKeyword = (keyword = '') => {
    entryKeyword.value = keyword.trim()
  }

  const patchTypeItems = (typeId: string, items: DictionaryEntryItem[]) => {
    const target = dictionaryList.value.find((item) => item.id === typeId)
    if (!target) return
    target.items = items
    dictionaryStore.syncFromList(dictionaryList.value)
  }

  const removeEntriesLocally = (typeId: string, entryIds: string[]) => {
    const target = dictionaryList.value.find((item) => item.id === typeId)
    if (!target) return

    const idSet = new Set(entryIds)
    patchTypeItems(
      typeId,
      (target.items || []).filter((item) => !idSet.has(item.id))
    )
  }

  return {
    dictionaryList,
    listLoading,
    currentTypeId,
    currentType,
    currentTypeCode,
    entryList,
    entryKeyword,
    refreshList,
    selectType,
    setEntryKeyword,
    removeEntriesLocally
  }
}
