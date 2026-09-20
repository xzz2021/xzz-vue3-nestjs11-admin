import { getRoleMenuApi } from '@/api/login'
import { getPersonByIdApi } from '@/api/user'
import { useUserStoreWithOut } from '@/store/modules/user'
import { ensureRouteTree } from '@/utils/tree'
import axios from 'axios'
import { refreshToken } from './auth'

let restorePromise: Promise<boolean> | null = null
let restoreFailed = false
let sessionHydrated = false

export const markSessionRestorable = () => {
  restoreFailed = false
  sessionHydrated = false
}

export const markSessionUnrestorable = () => {
  restoreFailed = true
  sessionHydrated = false
}

export const markSessionReady = () => {
  restoreFailed = false
  sessionHydrated = true
}

const loadSessionProfile = async () => {
  const userStore = useUserStoreWithOut()
  const [profileRes, menuRes] = await Promise.all([
    userStore.getUserInfo ? Promise.resolve(null) : getPersonByIdApi(),
    userStore.getRoleRouters?.length ? Promise.resolve(null) : getRoleMenuApi()
  ])

  if (profileRes?.data?.userinfo) {
    const info = profileRes.data.userinfo
    userStore.setUserInfo({
      id: info.id,
      username: info.username,
      phone: info.phone,
      avatar: info.avatar,
      email: info.email,
      nickname: info.nickname,
      roles: info.roles?.flatMap((item) => (item.role ? [item.role] : []))
    })
  }

  if (menuRes?.data?.list) {
    userStore.setRoleRouters(ensureRouteTree(menuRes.data.list))
  }
}

const restoreOnce = async (): Promise<boolean> => {
  const userStore = useUserStoreWithOut()
  try {
    const token = userStore.getToken || (await refreshToken())
    userStore.setToken(token)
    await loadSessionProfile()
    if (!userStore.getUserInfo) {
      restoreFailed = true
      return false
    }
    restoreFailed = false
    sessionHydrated = true
    return true
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      restoreFailed = true
      userStore.setToken('')
      userStore.setUserInfo()
      userStore.setRoleRouters([])
    }
    return false
  }
}

/** 刷新页后用 httpOnly refresh cookie 换 access，并重拉 userInfo / 菜单 */
export const restoreSession = async (): Promise<boolean> => {
  const userStore = useUserStoreWithOut()
  if (sessionHydrated && userStore.getToken && userStore.getUserInfo) {
    restoreFailed = false
    return true
  }
  if (restoreFailed) return false
  if (!restorePromise) {
    restorePromise = restoreOnce().finally(() => {
      restorePromise = null
    })
  }
  return restorePromise
}
