import { defineStore } from 'pinia'
import { store } from '../index'

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface LockInfo {
  isLock?: boolean
  /** SHA-256 hex，禁止持久化明文锁屏密码 */
  passwordHash?: string
}

interface LockState {
  lockInfo: LockInfo
}

export const useLockStore = defineStore('lock', {
  state: (): LockState => {
    return {
      lockInfo: {}
    }
  },
  getters: {
    getLockInfo(): LockInfo {
      return this.lockInfo
    }
  },
  actions: {
    async setLockInfo(lockInfo: { isLock?: boolean; password?: string }) {
      const next: LockInfo = {
        isLock: lockInfo.isLock
      }
      if (lockInfo.password) {
        next.passwordHash = await sha256Hex(lockInfo.password)
      }
      this.lockInfo = next
    },
    resetLockInfo() {
      this.lockInfo = {}
    },
    async unLock(password: string) {
      const expected = this.lockInfo?.passwordHash
      if (!expected) {
        this.resetLockInfo()
        return true
      }
      const actual = await sha256Hex(password)
      if (actual === expected) {
        this.resetLockInfo()
        return true
      }
      return false
    }
  },
  persist: {
    pick: ['lockInfo'],
    afterHydrate: (ctx) => {
      const info = ctx.store.lockInfo as LockInfo & { password?: string }
      // 清理历史明文密码；无哈希的旧锁屏状态视为无效
      if (info && 'password' in info) {
        const { password: _removed, ...rest } = info
        ctx.store.lockInfo = rest
      }
      if (ctx.store.lockInfo?.isLock && !ctx.store.lockInfo?.passwordHash) {
        ctx.store.lockInfo = {}
      }
    }
  }
})

export const useLockStoreWithOut = () => {
  return useLockStore(store)
}
