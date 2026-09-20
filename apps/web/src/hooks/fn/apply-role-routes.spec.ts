import { applyRoleRouters, ROLE_ROUTES_EMPTY_MESSAGE } from './apply-role-routes'

describe('applyRoleRouters', () => {
  it('throws when the menu list is empty and does not generate routes', async () => {
    const generate = vi.fn()

    await expect(applyRoleRouters({ list: [], generate })).rejects.toThrow(ROLE_ROUTES_EMPTY_MESSAGE)
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not swallow generateRoutes failures so callers cannot mark routers as added', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('生成路由失败: boom'))

    await expect(
      applyRoleRouters({
        list: [{ path: '/dashboard', name: 'Dashboard', component: '#', id: '1' }],
        generate
      })
    ).rejects.toThrow('生成路由失败: boom')
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('returns the prepared routers only after generate succeeds', async () => {
    const generate = vi.fn().mockResolvedValue(undefined)
    const list = [{ path: '/dashboard', name: 'Dashboard', component: '#', id: '1' }]

    await expect(applyRoleRouters({ list, generate })).resolves.toEqual(list)
    expect(generate).toHaveBeenCalledWith(list)
  })
})
