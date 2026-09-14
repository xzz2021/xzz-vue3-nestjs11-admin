import { presignOssGetApi } from '@/api/oss'
import type { OssFileItem } from '@/api/oss/types'
import { useI18n } from '@/hooks/web/useI18n'
import { getFileIcon2 } from '@/utils/file'
import { getPreviewFilename, isPreviewableType, openPreview } from '@/utils/preview'
import { ElMessage } from 'element-plus'

export const previewOssFile = async (item: OssFileItem) => {
  const { t } = useI18n()
  const fileType = getFileIcon2(item.name.split('.').pop() || '').type
  if (!isPreviewableType(fileType)) {
    try {
      const res = await presignOssGetApi({ key: item.key, disposition: 'attachment' })
      window.open(res.data.url, '_blank')
    } catch {
      ElMessage.error(t('file.previewUnsupported', { type: fileType }))
    }
    return
  }

  try {
    const res = await presignOssGetApi({ key: item.key, disposition: 'inline' })
    await openPreview({
      type: fileType,
      url: res.data.url,
      filename: getPreviewFilename(item.name)
    })
  } catch {
    ElMessage.error(t('file.previewFailed'))
  }
}
