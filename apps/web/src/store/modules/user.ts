import type { UserLoginInfoType } from '@/api/login/types'
import type { UserItem } from '@/api/user/types'
import defaultAvatar from '@/assets/imgs/avatar.jpg'
import { useI18n } from '@/hooks/web/useI18n'
import router from '@/router'
import { resolveAvatarUrl } from '@/utils/file'
import { ElMessageBox } from 'element-plus'
import { defineStore } from 'pinia'
import { store } from '../index'
import { useTagsViewStore } from './tagsView'

interface UserState {
  userInfo: UserItem | undefined
  tokenKey: string
  token: string
  roleRouters?: string[] | AppCustomRouteRecordRaw[]
  rememberMe: boolean
  loginInfo?: UserLoginInfoType
  unReadCount: number
  avatarVersion: number
}

// const initUserInfo: UserItem = {
//   id: 0,
//   username: '',
//   phone: '',
//   avatar: '',
//   roles: [],
//   departments: [],
//   email: ''
// }
export const useUserStore = defineStore('user', {
  state: (): UserState => {
    return {
      userInfo: undefined,
      tokenKey: 'Authorization',
      token: '',
      roleRouters: undefined,
      // 记住我
      rememberMe: true,
      loginInfo: undefined,
      unReadCount: 0,
      // 用户头像版本号  因为用户更新图片名称可能相同 所以需要版本号来区分
      avatarVersion: Date.now(),
    }
  },
  getters: {
    getTokenKey(): string {
      return this.tokenKey
    },
    getToken(): string {
      return this.token
    },
    getUserInfo(): UserItem | undefined {
      return this.userInfo
    },
    getRoleRouters(): string[] | AppCustomRouteRecordRaw[] | undefined {
      return this.roleRouters
    },
    getRememberMe(): boolean {
      return this.rememberMe
    },
    getLoginInfo(): UserLoginInfoType | undefined {
      return this.loginInfo
    },
    getUserAvatar(): string {
      return this.userInfo?.avatar || defaultAvatar
    },
    getUserAvatarUrl(): string {
      const url = resolveAvatarUrl(this.userInfo?.avatar, this.avatarVersion)
      return url || defaultAvatar
    },
    getUnReadCount(): number {
      return this.unReadCount
    },
  },
  actions: {
    setTokenKey(tokenKey: string) {
      this.tokenKey = tokenKey
    },
    setToken(token: string) {
      this.token = token
    },
    setUserInfo(userInfo?: UserItem) {
      this.userInfo = userInfo
    },
    bumpAvatarVersion() {
      this.avatarVersion = Date.now()
    },
    setRoleRouters(roleRouters: string[] | AppCustomRouteRecordRaw[]) {
      this.roleRouters = roleRouters
    },
    logoutConfirm() {
      const { t } = useI18n()
      ElMessageBox.confirm(t('common.loginOutMessage'), t('common.reminder'), {
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }).then(async () => {
        this.reset()
      })
    },
    async cmdLogout() {
      // const res = await forceLogoutApi(id).catch(() => {})
      // 这里是收到 强制退出命令    应该做下打点记录  调用登出接口 及 登出原因类型
      this.reset()
    },
    reset() {
      const tagsViewStore = useTagsViewStore()
      tagsViewStore.delAllViews(false)
      this.setToken('')
      this.setUserInfo()
      this.setRoleRouters([])
      router.replace('/login')
    },
    logout() {
      this.reset()
    },
    setRememberMe(rememberMe: boolean) {
      this.rememberMe = rememberMe
    },
    setLoginInfo(loginInfo: UserLoginInfoType | undefined) {
      if (!loginInfo) {
        this.loginInfo = undefined
        return
      }
      // 明确剔除 password，防止被写入持久化存储
      this.loginInfo = {
        phone: loginInfo.phone,
        ...(loginInfo.username ? { username: loginInfo.username } : {}),
      }
    },
    // async setUnReadCount() {
    //   const res = await getUnReadMsgCountApi()
    //   this.unReadCount = res?.total || 0
    // }
  },
  persist: {
    pick: ['tokenKey', 'token', 'userInfo', 'roleRouters', 'rememberMe', 'loginInfo', 'unReadCount', 'avatarVersion'],
    // 这个「把persist持久化数据灌回内存状态」的过程，就叫 hydrate / 水合
    // afterHydrate 在「灌完之后立刻再跑一次清理  避免历史脏数据
    afterHydrate: (ctx) => {
      const info = ctx.store.loginInfo as (UserLoginInfoType & { password?: string }) | undefined
      if (info && 'password' in info) {
        ctx.store.loginInfo = {
          phone: info.phone,
          ...(info.username ? { username: info.username } : {}),
        }
      }
    },
  },
})

export const useUserStoreWithOut = () => {
  return useUserStore(store)
}
