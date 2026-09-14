import { type VNode, createVNode, render } from 'vue'
import AudioPlayer from './src/AudioPlayer.vue'
import { isClient } from '@/utils/is'
import { toAnyString } from '@/utils'

export { AudioPlayer }

interface AudioViewerOptions {
  id?: string
  url: string
  filename: string
  poster?: string
  show?: boolean
  onUnavailable?: () => void
}

let instance: VNode | null = null
let container: HTMLElement | null = null

export function destroyAudioViewer() {
  if (!container) {
    instance = null
    return
  }
  render(null, container)
  container.remove()
  container = null
  instance = null
}

/** @deprecated 使用 destroyAudioViewer */
export function destroyAllAudioViewers() {
  destroyAudioViewer()
}

export function createAudioViewer(options: AudioViewerOptions) {
  if (!isClient) return

  // 每次打开先销毁旧实例，避免残留层无法关闭
  destroyAudioViewer()

  container = document.createElement('div')
  const id = toAnyString()
  container.id = id
  document.body.appendChild(container)

  instance = createVNode(AudioPlayer, {
    id,
    url: options.url,
    filename: options.filename || '未知音频',
    poster: options.poster || '',
    show: true,
    onClose: () => {
      destroyAudioViewer()
    },
    onUnavailable: () => {
      // 先销毁播放器，再交给业务侧确认是否清理无效数据
      destroyAudioViewer()
      options.onUnavailable?.()
    }
  })
  render(instance, container)
}
