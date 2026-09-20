export const USER_PERSIST_PICK = ['tokenKey', 'rememberMe', 'loginInfo'] as const

export const purgeLegacyAuthStorage = (
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = typeof localStorage === 'undefined'
    ? undefined
    : localStorage
) => {
  if (!storage) return
  const raw = storage.getItem('user')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if ('token' in parsed || 'userInfo' in parsed || 'roleRouters' in parsed) {
        delete parsed.token
        delete parsed.userInfo
        delete parsed.roleRouters
        storage.setItem('user', JSON.stringify(parsed))
      }
    } catch {
      storage.removeItem('user')
    }
  }
  storage.removeItem('permission')
}

