import { ref, onUnmounted } from 'vue'

export function usePolling(fn: () => void, interval = 2000) {
  // 定义轮询状态和计时器
  const isPolling = ref(false)
  let timer: null | NodeJS.Timeout = null
  // 轮询次数
  const pollingCount = ref(0)
  // 开始轮询
  const start = () => {
    if (isPolling.value) return // 防止重复启动
    isPolling.value = true
    timer = setInterval(() => {
      if (pollingCount.value > 30) {
        stop()
        return
      }
      pollingCount.value++
      fn() // 执行传入的轮询函数
    }, interval)
  }

  // 停止轮询
  const stop = () => {
    if (!isPolling.value) return // 如果未启动轮询则不做任何操作
    if (timer) {
      clearInterval(timer)
    }
    isPolling.value = false
    pollingCount.value = 0
  }

  // 移除轮询计时器
  const removePolling = () => {
    if (timer) {
      clearInterval(timer)
    }
    isPolling.value = false
    pollingCount.value = 0
    timer = null
  }

  // 组件销毁时清除计时器
  onUnmounted(() => {
    removePolling()
  })

  return {
    isPolling,
    start,
    stop,
    removePolling
  }
}
