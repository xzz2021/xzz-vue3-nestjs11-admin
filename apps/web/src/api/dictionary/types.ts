export interface DictionaryEntryItem {
  id: string
  typeId: string
  label: string
  value: string
  sort: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DictionaryTypeItem {
  id: string
  name: string
  code: string
  enabled: boolean
  items?: DictionaryEntryItem[]
  createdAt?: string
  updatedAt?: string
}

export interface SaveDictionaryTypeDto {
  id?: string
  name: string
  code: string
  enabled?: boolean
}

export interface SaveDictionaryEntryDto {
  id?: string
  typeId: string
  label: string
  value: string
  sort?: number
  enabled?: boolean
}

export interface DictionaryListResponse {
  list: DictionaryTypeItem[]
}

/** @deprecated 使用 DictionaryTypeItem */
export type DictionaryItem = DictionaryTypeItem

/** @deprecated 使用 DictionaryEntryItem */
export type DictionaryEntry = DictionaryEntryItem

/** @deprecated 使用 DictionaryListResponse */
export interface DictionaryList {
  list: DictionaryTypeItem[]
  total: number
}
