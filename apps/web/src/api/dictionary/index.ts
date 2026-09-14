import request from '@/axios'
import type { DictionaryListResponse, DictionaryTypeItem, SaveDictionaryEntryDto, SaveDictionaryTypeDto } from './types'

export * from './types'

export const getDictionaryListApi = (): Promise<IResponse<DictionaryListResponse>> => {
  return request.get({ url: 'dictionary/list' })
}

export const saveDictionaryTypeApi = (data: SaveDictionaryTypeDto): Promise<IResponse<{ id: string }>> => {
  const payload: Recordable = {
    name: data.name,
    code: data.code,
    status: data.enabled ?? true
  }
  if (data.id) payload.id = data.id
  return request.post({ url: 'dictionary/upsert', data: payload })
}

export const delDictionaryTypeApi = (ids: string[]): Promise<IResponse<{ count: number }>> => {
  return request.delete({ url: 'dictionary/delete', data: { ids } })
}

export const saveDictionaryEntryApi = (data: SaveDictionaryEntryDto): Promise<IResponse<{ id: string }>> => {
  const payload: Recordable = {
    name: data.label,
    code: data.value,
    dictionaryId: data.typeId,
    sort: data.sort ?? 0,
    enabled: data.enabled ?? true
  }
  if (data.id) payload.id = data.id
  return request.post({ url: 'dictionary/entry/upsert', data: payload })
}

export const delDictionaryEntryApi = (ids: string[]): Promise<IResponse<{ count: number }>> => {
  return request.delete({ url: 'dictionary/entry/delete', data: { ids } })
}

/** @deprecated 使用 saveDictionaryTypeApi */
export const upsertDictionaryApi = saveDictionaryTypeApi

/** @deprecated 使用 delDictionaryTypeApi */
export const delDictionaryApi = delDictionaryTypeApi

/** @deprecated 使用 saveDictionaryEntryApi */
export const upsertDicEntryApi = saveDictionaryEntryApi

/** @deprecated 使用 delDictionaryEntryApi */
export const delDicEntryApi = delDictionaryEntryApi

export const generateDictionarySeedApi = (data: DictionaryTypeItem[]): Promise<IResponse<{ success: boolean }>> => {
  const payload = data.map((item) => ({
    name: item.name,
    code: item.code,
    status: item.enabled ?? true,
    entries: (item.items || []).map((entry) => ({
      name: entry.label,
      code: entry.value,
      sort: entry.sort,
      enabled: entry.enabled
    }))
  }))
  return request.post({ url: 'dictionary/generateDictionarySeed', data: { data: payload } })
}
