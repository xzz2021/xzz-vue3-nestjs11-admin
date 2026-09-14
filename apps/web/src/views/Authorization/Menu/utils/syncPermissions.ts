import { addPermissionApi, delPermissionApi, updatePermissionApi } from '@/api/menu'
import type { MenuPermission } from '@/api/menu/types'

export const isTempPermissionId = (id?: string) => !id || id.startsWith('temp_')

export const syncPermissions = async (
  menuId: string,
  newPermissions: MenuPermission[],
  oldPermissions: MenuPermission[] = []
) => {
  const oldMap = new Map(oldPermissions.filter((p) => p.id).map((p) => [p.id!, p]))
  const newMap = new Map(newPermissions.filter((p) => p.id && !isTempPermissionId(p.id)).map((p) => [p.id!, p]))

  for (const old of oldPermissions) {
    if (old.id && !newMap.has(old.id)) {
      await delPermissionApi(old.id)
    }
  }

  for (const permission of newPermissions) {
    const payload = {
      name: permission.name,
      code: permission.code,
      type: permission.type,
      sort: permission.sort ?? 0,
      enabled: permission.enabled ?? true,
      scopeEnabled: permission.scopeEnabled ?? false
    }

    if (permission.id && !isTempPermissionId(permission.id)) {
      const prev = oldMap.get(permission.id)
      const changed =
        !prev ||
        prev.name !== permission.name ||
        prev.code !== permission.code ||
        prev.type !== permission.type ||
        prev.sort !== permission.sort ||
        prev.enabled !== permission.enabled ||
        (prev.scopeEnabled ?? false) !== payload.scopeEnabled

      if (changed) {
        await updatePermissionApi({ id: permission.id, ...payload })
      }
    } else {
      await addPermissionApi({ ...payload, menuId })
    }
  }
}
