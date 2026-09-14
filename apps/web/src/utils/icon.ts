/** Lucide Icons（Iconify `lucide`）短名工具。菜单 / Icon 只存短名，如 `user`、`settings`。 */

const LUCIDE_COLLECTION = 'lucide'

/** 将历史写法归一为 lucide 短名：`i-lucide-user` / `lucide:user` / `vi-ep:user` / `user` → `user` */
export const toLucideIconName = (icon?: string | null): string => {
  if (!icon) return ''
  let name = icon.trim()
  if (!name || name.startsWith('svg-icon:')) return name

  if (name.startsWith('i-lucide-')) name = name.slice('i-lucide-'.length)
  else if (name.startsWith('i-lucide:')) name = name.slice('i-lucide:'.length)
  else if (name.startsWith('vi-lucide:')) name = name.slice('vi-lucide:'.length)
  else if (name.startsWith('lucide:')) name = name.slice('lucide:'.length)
  else if (name.startsWith('i-ep-')) name = name.slice('i-ep-'.length)
  else if (name.startsWith('i-ep:')) name = name.slice('i-ep:'.length)
  else if (name.startsWith('vi-ep:')) name = name.slice('vi-ep:'.length)
  else if (name.startsWith('ep:')) name = name.slice('ep:'.length)
  else if (name.includes(':')) {
    // 其它集合历史数据：丢掉集合前缀，仅保留名称
    name = name.slice(name.lastIndexOf(':') + 1)
  }

  return name
}

/** @deprecated 使用 toLucideIconName */
export const toEpIconName = toLucideIconName

/** UnoCSS 静态 class，例如 `i-lucide-user` */
export const toLucideUnoClass = (icon?: string | null): string => {
  const name = toLucideIconName(icon)
  if (!name || name.startsWith('svg-icon:')) return ''
  return `i-${LUCIDE_COLLECTION}-${name}`
}

/** @deprecated 使用 toLucideUnoClass */
export const toEpUnoClass = toLucideUnoClass
