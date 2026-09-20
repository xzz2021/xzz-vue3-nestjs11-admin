import { USER_PERSIST_PICK, purgeLegacyAuthStorage } from './user-persist'

describe('user persist pick', () => {
  it('does not persist access token, userInfo, or role routers', () => {
    expect(USER_PERSIST_PICK).not.toContain('token')
    expect(USER_PERSIST_PICK).not.toContain('userInfo')
    expect(USER_PERSIST_PICK).not.toContain('roleRouters')
    expect(USER_PERSIST_PICK).toEqual(
      expect.arrayContaining(['rememberMe', 'loginInfo', 'tokenKey'])
    )
  })

  it('strips leftover token fields from previous localStorage snapshots', () => {
    const storage = new Map<string, string>([
      ['user', JSON.stringify({ token: 'secret', userInfo: { id: '1' }, rememberMe: true })],
      ['permission', JSON.stringify({ routers: [] })]
    ])
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      }
    }

    purgeLegacyAuthStorage(adapter)

    expect(JSON.parse(storage.get('user') || '{}')).toEqual({ rememberMe: true })
    expect(storage.has('permission')).toBe(false)
  })
})
