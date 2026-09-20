import { getRoutePermissions } from './route-permission'

describe('getRoutePermissions', () => {
  it('reads meta.permissions as the canonical list', () => {
    expect(getRoutePermissions({ permissions: ['oss:add'] })).toEqual(['oss:add'])
  })

  it('falls back to legacy meta.permission so old persisted routes still work', () => {
    expect(getRoutePermissions({ permission: ['oss:delete'] })).toEqual(['oss:delete'])
  })

  it('prefers permissions when both keys exist', () => {
    expect(
      getRoutePermissions({
        permissions: ['oss:add'],
        permission: ['oss:delete']
      })
    ).toEqual(['oss:add'])
  })

  it('returns an empty list when neither key is a string array', () => {
    expect(getRoutePermissions({})).toEqual([])
    expect(getRoutePermissions({ permissions: 'oss:add' })).toEqual([])
  })
})
