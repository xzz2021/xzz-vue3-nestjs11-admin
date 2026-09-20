import { canAttemptTokenRefresh, shouldSkipTokenRefresh } from './auth-refresh'

describe('shouldSkipTokenRefresh', () => {
  it('skips login, refresh, register, and captcha requests', () => {
    expect(shouldSkipTokenRefresh('auth/rt/login')).toBe(true)
    expect(shouldSkipTokenRefresh('/api/auth/refresh')).toBe(true)
    expect(shouldSkipTokenRefresh('auth/register')).toBe(true)
    expect(shouldSkipTokenRefresh('captcha/common')).toBe(true)
  })

  it('allows refresh for protected APIs', () => {
    expect(shouldSkipTokenRefresh('user/detailInfo')).toBe(false)
    expect(shouldSkipTokenRefresh('role/getRoleMenu')).toBe(false)
  })
})

describe('canAttemptTokenRefresh', () => {
  it('refreshes protected 401s even when access token is only in memory and missing', () => {
    expect(
      canAttemptTokenRefresh({
        status: 401,
        url: 'user/detailInfo',
        alreadyRetried: false,
        hasAccessToken: false
      })
    ).toBe(true)
  })

  it('does not refresh a failed login or an already retried request', () => {
    expect(
      canAttemptTokenRefresh({
        status: 401,
        url: 'auth/rt/login',
        alreadyRetried: false,
        hasAccessToken: false
      })
    ).toBe(false)
    expect(
      canAttemptTokenRefresh({
        status: 401,
        url: 'user/list',
        alreadyRetried: true,
        hasAccessToken: true
      })
    ).toBe(false)
  })
})
