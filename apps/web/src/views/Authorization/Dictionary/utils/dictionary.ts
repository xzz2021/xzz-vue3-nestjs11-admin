import type { DictionaryEntryItem } from '@/api/dictionary/types'

export const filterDictionaryEntries = (entries: DictionaryEntryItem[], keyword = ''): DictionaryEntryItem[] => {
  const text = keyword.trim()
  if (!text) return entries

  return entries.filter((entry) => entry.label.includes(text) || entry.value.includes(text))
}

export const filterDictionaryTypesByName = <T extends { name: string }>(list: T[], keyword = ''): T[] => {
  const text = keyword.trim()
  if (!text) return list
  return list.filter((item) => item.name.includes(text))
}
