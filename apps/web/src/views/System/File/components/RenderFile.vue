<template>
  <div class="w-full h-[100px] flex justify-center items-center gap-1 px-1">
    <RenderPreview class="cursor-pointer" />
  </div>
</template>
<script setup lang="tsx">
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { getFileType } from '@/utils/file'
import { openPreview, type PreviewableType } from '@/utils/preview'
import { ElImage } from 'element-plus'
import { defineComponent, ref } from 'vue'

interface PropsItem {
  extension: string
  url: string
  filename: string
}

const props = defineProps<PropsItem>()
const emit = defineEmits<{
  unavailable: []
}>()

const { t } = useI18n()
const imageFailed = ref(false)
const probing = ref(false)

const notifyUnavailable = () => {
  emit('unavailable')
}

const open = async (type: PreviewableType, probe = false) => {
  if (!props.url || probing.value) return
  probing.value = true
  try {
    await openPreview({
      type,
      url: props.url,
      filename: props.filename,
      probe,
      onUnavailable: notifyUnavailable
    })
  } finally {
    probing.value = false
  }
}

const RenderPreview = defineComponent({
  setup() {
    return () => {
      const type = getFileType(props.extension)
      const url = props.url
      const filename = props.filename
      const title = probing.value ? t('file.probing') : filename

      switch (type) {
        case 'image':
          if (imageFailed.value) {
            return (
              <div
                class="w-full flex items-center justify-center text-12px color-[var(--el-color-danger)]"
                onClick={notifyUnavailable}
              >
                {t('file.imageUnavailable')}
              </div>
            )
          }
          return (
            <div class="w-full" onClick={() => open('image')}>
              <ElImage
                src={url}
                fit="cover"
                class="w-[100%] pointer-events-none"
                lazy
                onError={() => {
                  imageFailed.value = true
                }}
                v-slots={{
                  error: () => <div class="text-12px color-[var(--el-color-danger)]">{t('file.imageUnavailable')}</div>
                }}
              />
            </div>
          )
        case 'audio':
          return (
            <div onClick={() => open('audio', true)} class="w-full flex items-center" title={title}>
              <Icon icon="headphones" style={{ color: '#0dc70b' }} />
              <div class="ml-2 w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
            </div>
          )
        case 'video':
          return (
            <div onClick={() => open('video', true)} class="w-full flex items-center" title={title}>
              <Icon icon="film" style={{ color: '#ff6b12' }} />
              <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
            </div>
          )
        case 'doc':
          return (
            <div onClick={() => open('doc', true)} class="w-full flex items-center" title={title}>
              <Icon icon="file-text" style={{ color: '#0070ff' }} />
              <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
            </div>
          )
        default:
          return <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
      }
    }
  }
})
</script>
