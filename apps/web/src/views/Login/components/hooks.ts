import { useRoleMenu } from '@/hooks/fn/useRoleMenu'
import { useUserStore } from '@/store/modules/user'

export const useLogin = () => {
  const { getRole } = useRoleMenu()

  const userStore = useUserStore()
  const successLogin = async (userinfo: any, access_token: string) => {
    userStore.setUserInfo(userinfo)
    userStore.setToken(access_token) // 设置新token
    await getRole()
  }

  return {
    successLogin,
  }
}
