import { ensureRouteTree } from '@/utils/tree'

export const ROLE_ROUTES_EMPTY_MESSAGE = '角色路由为空,请检查重试!'

export const applyRoleRouters = async (input: {
  list?: AppCustomRouteRecordRaw[] | null
  generate: (routers: AppCustomRouteRecordRaw[]) => Promise<unknown>
}): Promise<AppCustomRouteRecordRaw[]> => {
  if (!input.list?.length) {
    throw new Error(ROLE_ROUTES_EMPTY_MESSAGE)
  }
  const routers = ensureRouteTree(input.list)
  try {
    await input.generate(routers)
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }
  return routers
}
