import { useIdle } from '@vueuse/core'
import mitt from 'mitt'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useUserStore } from './user'

/**
 * 将路径中重复的正斜杆替换成单个斜杆隔开的字符串
 * @param path 要处理的路径
 * @returns {string} 将/去重后的结果
 */
const uniqueSlash = (path: string) => path.replace(/(https?:\/)|(\/)+/g, '$1$2')

export type MessageEvent = {
  data?: any
  type?: 'ping' | 'close' | 'updatePermsAndMenus' | 'updateOnlineUserCount' | 'focusLogOut'
}

type Events = {
  onlineUser: number
}

export const useSSEStore = defineStore('sse', () => {
  const emitter = mitt<Events>()
  const userStore = useUserStore()
  const { idle } = useIdle(1 * 60 * 1000) // 5 min
  let eventSource: EventSource | null = null
  const serverConnected = ref(true)
  const onlineUserCount = ref(0)

  watch(serverConnected, (val) => {
    if (val && userStore.token) {
      initServerMsgListener()
    } else {
      closeEventSource()
    }
  })

  watch(idle, (idleValue) => {
    // console.log('idleValue', idleValue)
    if (idleValue) {
      closeEventSource()
    } else if (userStore.token) {
      setServerConnectStatus(true)
    }
  })

  const closeEventSource = () => {
    serverConnected.value = false
    eventSource?.close()
    eventSource = null
  }

  /** 监听来自服务端推送的消息 */ // 要确保刷新不丢失通信  需要将initServerMsgListener放在每次刷新必定加载的dom里
  const initServerMsgListener = async () => {
    if (eventSource) {
      eventSource.close()
    }
    const uid = userStore.userInfo?.id
    if (!uid) return
    const sseUrl = uniqueSlash(`${import.meta.env.VITE_API_BASE_PATH}/sse/${uid}`)

    // console.log('sseUrl=-====', sseUrl)

    eventSource = new EventSource(sseUrl, {
      withCredentials: true
    })

    // 处理 SSE 传递的数据
    eventSource.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data) as MessageEvent
      // 服务器关闭 SSE 连接
      if (type === 'close') {
        closeEventSource()
      }
      // 当用户的权限及菜单有变更时，重新获取权限及菜单
      else if (type === 'updatePermsAndMenus') {
        // userStore.fetchPermsAndMenus()
      }
      // 在线用户数量变更时
      else if (type === 'updateOnlineUserCount' && location.hash == '#/system/onlineUser') {
        onlineUserCount.value = ~~data // 双按位取反  效果等价于把一个数 向零取整  把原数的小数部分截掉，只保留整数部分
        emitter.emit('onlineUser', onlineUserCount.value)
      } else if (type === 'focusLogOut') {
        closeEventSource()
        userStore.cmdLogout()
      }
      // console.log('eventSource', event.data)
    }
    eventSource.onerror = (err) => {
      console.log('eventSource err', err)
      closeEventSource()
    }
  }

  const setServerConnectStatus = (isConnect: boolean) => {
    serverConnected.value = isConnect
  }

  return {
    emitter,
    onlineUserCount,
    closeEventSource,
    initServerMsgListener,
    setServerConnectStatus
  }
})
