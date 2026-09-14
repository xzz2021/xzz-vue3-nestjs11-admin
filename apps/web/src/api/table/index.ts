import { ok } from '../_local'
import type { TableData } from './types'

const authors = ['Amy', 'Bob', 'Cindy', 'David', 'Eva']
const titles = ['Intro', 'Guide', 'Tips', 'FAQ', 'Notes']

const createRows = (count: number, start = 0): TableData[] =>
  Array.from({ length: count }, (_, i) => {
    const id = String(start + i + 1)
    return {
      id,
      author: authors[i % authors.length],
      title: `${titles[i % titles.length]} #${id}`,
      content: `Sample content for row ${id}`,
      importance: (i % 3) + 1,
      display_time: new Date(Date.now() - i * 3600_000).toISOString(),
      pageviews: 100 + i * 17
    }
  })

const paginate = <T>(list: T[], params: { pageIndex?: number; pageSize?: number }) => {
  const pageIndex = params.pageIndex || 1
  const pageSize = params.pageSize || 10
  const start = (pageIndex - 1) * pageSize
  return {
    list: list.slice(start, start + pageSize),
    total: list.length
  }
}

const allRows = createRows(36)

export const getTableListApi = (params: any) => {
  return ok(paginate(allRows, params || {}))
}

export const getCardTableListApi = (params: any) => {
  const cards = allRows.map((row) => ({
    ...row,
    name: row.title,
    desc: row.content,
    image: 'https://picsum.photos/seed/' + row.id + '/200/120'
  }))
  return ok(paginate(cards, params || {}))
}

export const getTreeTableListApi = (params: any) => {
  const roots = createRows(8).map((row, index) => ({
    ...row,
    children:
      index % 2 === 0
        ? createRows(2, 100 + index * 10).map((child) => ({ ...child, content: `Child of ${row.id}` }))
        : undefined
  }))
  return ok(paginate(roots, params || {}))
}

export const saveTableApi = (data: Partial<TableData>): Promise<IResponse> => {
  return ok({ id: data.id || String(Date.now()) })
}

export const getTableDetApi = (id: string): Promise<IResponse<TableData>> => {
  const found = allRows.find((item) => item.id === id) || allRows[0]
  return ok({ ...found, id })
}

export const delTableListApi = (_ids: string[] | number[]): Promise<IResponse> => {
  return ok(true)
}
