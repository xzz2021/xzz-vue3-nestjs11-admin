import { useRoleMenu } from '@/hooks/fn/useRoleMenu'
import { useUserStore } from '@/store/modules/user'
import type { LoginUser } from '@/api/login/types'
import { markSessionReady, markSessionRestorable } from '@/axios/session'

export const useLogin = () => {
  const { getRole } = useRoleMenu()

  const userStore = useUserStore()
  const successLogin = async (userinfo: LoginUser, access_token: string) => {
    markSessionRestorable()
    userStore.setUserInfo(userinfo)
    userStore.setToken(access_token) // 设置新token
    try {
      await getRole()
      markSessionReady()
    } catch (error) {
      await userStore.abortSession()
      throw error
    }
  }

  return {
    successLogin,
  }
}
