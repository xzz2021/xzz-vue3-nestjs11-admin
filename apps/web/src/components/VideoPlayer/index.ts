import { type VNode, createVNode, render } from 'vue'
import { isClient } from '@/utils/is'
import { VideoPlayerViewer } from '@/components/VideoPlayerViewer'
import { toAnyString } from '@/utils'
import VideoPlayer from './src/VideoPlayer.vue'

export { VideoPlayer }

let instance: VNode | null = null
let container: HTMLElement | null = null

export function destroyVideoViewer() {
  if (!container) {
    instance = null
    return
  }
  render(null, container)
  container.remove()
  container = null
  instance = null
}

export function createVideoViewer(options: {
  url: string
  poster?: string
  show?: boolean
  onUnavailable?: () => void
}) {
  if (!isClient) return

  destroyVideoViewer()

  container = document.createElement('div')
  const id = toAnyString()
  container.id = id
  document.body.appendChild(container)

  instance = createVNode(VideoPlayerViewer, {
    id,
    url: options.url,
    poster: options.poster,
    show: true,
    onClose: () => {
      destroyVideoViewer()
    },
    onUnavailable: () => {
      destroyVideoViewer()
      options.onUnavailable?.()
    }
  })
  render(instance, container)
}
