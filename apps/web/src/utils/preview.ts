import { createAudioViewer } from '@/components/AudioPlayer'
import { createImageViewer } from '@/components/ImageViewer'
import { createTxtViewer } from '@/components/TxtViewer'
import { createVideoViewer } from '@/components/VideoPlayer'
import { useI18n } from '@/hooks/web/useI18n'
import { probeFileAccessible } from '@/utils/file'
import { ElMessage } from 'element-plus'

export const PREVIEWABLE_TYPES = ['image', 'video', 'audio', 'doc'] as const

export type PreviewableType = (typeof PREVIEWABLE_TYPES)[number]

export const isPreviewableType = (type: string): type is PreviewableType => {
  return (PREVIEWABLE_TYPES as readonly string[]).includes(type)
}

export const getPreviewFilename = (path: string) => {
  return path.split('/').filter(Boolean).pop() || path
}

export interface OpenPreviewOptions {
  type: string
  url: string
  filename?: string
  probe?: boolean
  onUnavailable?: () => void
}

const unavailableMessageKey = (type: PreviewableType) => {
  if (type === 'audio') return 'file.audioUnavailable'
  if (type === 'video') return 'file.videoUnavailable'
  if (type === 'image') return 'file.imageUnavailable'
  return 'file.previewFailed'
}

export const openPreview = async (options: OpenPreviewOptions): Promise<boolean> => {
  const { t } = useI18n()
  const { type, url, filename, probe = false, onUnavailable } = options

  if (!isPreviewableType(type)) {
    ElMessage.error(t('file.previewUnsupported', { type }))
    return false
  }

  if (!url) {
    ElMessage.error(t('file.previewUrlFailed'))
    return false
  }

  if (probe) {
    const accessible = await probeFileAccessible(url)
    if (!accessible) {
      ElMessage.error(t(unavailableMessageKey(type)))
      onUnavailable?.()
      return false
    }
  }

  const displayName = filename || getPreviewFilename(url)

  switch (type) {
    case 'image':
      createImageViewer({ urlList: [url] })
      break
    case 'video':
      createVideoViewer({ url, onUnavailable })
      break
    case 'audio':
      createAudioViewer({ url, filename: displayName, onUnavailable })
      break
    case 'doc':
      createTxtViewer({ url })
      break
  }

  return true
}
