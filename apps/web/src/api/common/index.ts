import { ok } from '../_local'

const dictOptions = [
  { label: 'option1', value: '1' },
  { label: 'option2', value: '2' },
  { label: 'option3', value: '3' },
  { label: 'option4', value: '4' },
  { label: 'option5', value: '5' }
]

/** 演示用字典列表（本地数据，非远程 /mock） */
export const getDictApi = () => {
  return ok(dictOptions)
}

/** 演示用单个字典选项（本地数据，非远程 /mock） */
export const getDictOneApi = async () => {
  return ok(dictOptions)
}
