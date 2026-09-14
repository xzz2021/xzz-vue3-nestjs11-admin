import { toAnyString } from '@/utils'
import { isClient } from '@/utils/is'
import { type VNode, createVNode, render } from 'vue'
import TxtViewerContainer from './src/TxtViewerContainer.vue'

let instance: Nullable<VNode> = null

export function createTxtViewer(options: { url: string; show?: boolean }) {
  if (!isClient) return
  const { url } = options
  const propsData: Partial<{ url: string; show?: boolean; id?: string }> = {}
  const container = document.createElement('div')
  const id = toAnyString()
  container.id = id
  propsData.url = url
  propsData.show = true
  propsData.id = id

  document.body.appendChild(container)
  instance = createVNode(TxtViewerContainer, propsData)
  render(instance, container)
}
