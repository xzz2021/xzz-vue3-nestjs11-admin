<script setup lang="ts">
import { ImageCropping } from '@/components/ImageCropping'
import { ref, unref } from 'vue'

defineProps({
  url: {
    type: String,
    default: ''
  }
})

const fileUrl = ref('')
const CropperRef = ref<ComponentRef<typeof ImageCropping>>()

const getCroppedFile = async (): Promise<File | null> => {
  const canvas = await unref(CropperRef)?.getCroppedCanvas()
  if (!canvas) return null

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        resolve(new File([blob], 'avatar.png', { type: blob.type || 'image/png' }))
      },
      'image/png',
      0.92
    )
  })
}

defineExpose({
  getCroppedFile
})
</script>

<template>
  <div>
    <ImageCropping ref="CropperRef" :image-url="fileUrl || url" />
  </div>
</template>
