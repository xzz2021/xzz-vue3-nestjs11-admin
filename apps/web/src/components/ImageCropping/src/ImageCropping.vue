<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { useDesign } from '@/hooks/web/useDesign'
import { useDebounceFn } from '@vueuse/core'
import Cropper from 'cropperjs'
import { ElDivider, ElMessage, ElTooltip, ElUpload, type UploadFile } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'

const CROPPER_TEMPLATE = `
<cropper-canvas background>
  <cropper-image rotatable scalable translatable></cropper-image>
  <cropper-shade hidden></cropper-shade>
  <cropper-handle action="move" plain></cropper-handle>
  <cropper-selection initial-coverage="0.5" movable resizable>
    <cropper-grid role="grid" bordered covered></cropper-grid>
    <cropper-crosshair centered></cropper-crosshair>
    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
    <cropper-handle action="n-resize"></cropper-handle>
    <cropper-handle action="e-resize"></cropper-handle>
    <cropper-handle action="s-resize"></cropper-handle>
    <cropper-handle action="w-resize"></cropper-handle>
    <cropper-handle action="ne-resize"></cropper-handle>
    <cropper-handle action="nw-resize"></cropper-handle>
    <cropper-handle action="se-resize"></cropper-handle>
    <cropper-handle action="sw-resize"></cropper-handle>
  </cropper-selection>
</cropper-canvas>
`

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('image-cropping')

const props = defineProps({
  imageUrl: {
    type: String,
    default: '',
    required: true
  },
  cropBoxWidth: {
    type: Number,
    default: 200
  },
  cropBoxHeight: {
    type: Number,
    default: 200
  },
  boxWidth: {
    type: [Number, String],
    default: 425
  },
  boxHeight: {
    type: [Number, String],
    default: 320
  },
  showResult: {
    type: Boolean,
    default: true
  },
  showActions: {
    type: Boolean,
    default: true
  }
})

const imgBase64 = ref('')
const containerRef = ref<HTMLElement>()
const cropperRef = ref<Cropper>()
const objectUrl = ref('')

const getCropperImage = () => unref(cropperRef)?.getCropperImage() ?? null
const getCropperSelection = () => unref(cropperRef)?.getCropperSelection() ?? null
const getCropperCanvas = () => unref(cropperRef)?.getCropperCanvas() ?? null

const getCroppedCanvas = async () => {
  const selection = getCropperSelection()
  if (!selection) return null
  try {
    return await selection.$toCanvas({
      width: props.cropBoxWidth,
      height: props.cropBoxHeight
    })
  } catch {
    return null
  }
}

const getBase64 = useDebounceFn(async () => {
  const canvas = await getCroppedCanvas()
  imgBase64.value = canvas?.toDataURL() ?? ''
}, 80)

const resetCropBox = () => {
  const selection = getCropperSelection()
  const canvas = getCropperCanvas()
  if (!selection || !canvas) return

  const { width: containerWidth, height: containerHeight } = canvas.getBoundingClientRect()
  const width = props.cropBoxWidth
  const height = props.cropBoxHeight
  selection.aspectRatio = width / height
  selection.$change((containerWidth - width) / 2, (containerHeight - height) / 2, width, height)
  getBase64()
}

const onCropChange = () => {
  getBase64()
}

const unbindCropperEvents = () => {
  getCropperCanvas()?.removeEventListener('action', onCropChange)
  getCropperCanvas()?.removeEventListener('actionend', onCropChange)
  getCropperSelection()?.removeEventListener('change', onCropChange)
  getCropperImage()?.removeEventListener('transform', onCropChange)
}

const bindCropperEvents = () => {
  getCropperCanvas()?.addEventListener('action', onCropChange)
  getCropperCanvas()?.addEventListener('actionend', onCropChange)
  getCropperSelection()?.addEventListener('change', onCropChange)
  getCropperImage()?.addEventListener('transform', onCropChange)
}

const replaceImage = (url: string) => {
  const image = getCropperImage()
  if (!image) return
  image.crossorigin = 'anonymous'
  image.src = url
  image.$ready(() => {
    image.$center('contain')
    resetCropBox()
  })
}

const initCropper = (src = props.imageUrl) => {
  if (unref(cropperRef) || !unref(containerRef) || !src) return

  const image = new Image()
  image.alt = ''
  image.crossOrigin = 'anonymous'
  image.src = src

  cropperRef.value = new Cropper(image, {
    container: unref(containerRef),
    template: CROPPER_TEMPLATE
  })

  bindCropperEvents()
  getCropperImage()?.$ready(() => {
    getCropperImage()?.$center('contain')
    resetCropBox()
  })
}

const getBoxStyle = computed(() => {
  return {
    width: `${props.boxWidth}px`,
    height: `${props.boxHeight}px`
  }
})

const getCropBoxStyle = computed(() => {
  return {
    width: `${props.cropBoxWidth}px`,
    height: `${props.cropBoxHeight}px`
  }
})

const getScaleSize = (scale: number) => {
  return {
    width: props.cropBoxWidth * scale + 'px',
    height: props.cropBoxHeight * scale + 'px'
  }
}

const uploadChange = (uploadFile: UploadFile) => {
  if (uploadFile?.raw?.type.indexOf('image') === -1) {
    ElMessage.error('请上传图片格式的文件')
    return
  }
  if (!uploadFile.raw) return
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = URL.createObjectURL(uploadFile.raw)
  if (!unref(cropperRef)) {
    initCropper(objectUrl.value)
    return
  }
  replaceImage(objectUrl.value)
}

const reset = () => {
  getCropperImage()?.$resetTransform()
  getCropperImage()?.$center('contain')
  getCropperSelection()?.$reset()
  resetCropBox()
}

const rotate = (deg: number) => {
  getCropperImage()?.$rotate(`${deg}deg`)
  getBase64()
}

const scale = (type: 'scaleX' | 'scaleY') => {
  if (type === 'scaleX') {
    getCropperImage()?.$scale(-1, 1)
  } else {
    getCropperImage()?.$scale(1, -1)
  }
  getBase64()
}

const zoom = (num: number) => {
  getCropperImage()?.$zoom(num)
  getBase64()
}

onMounted(() => {
  initCropper()
})

watch(
  () => props.imageUrl,
  (url) => {
    if (!url) return
    if (!unref(cropperRef)) {
      initCropper(url)
      return
    }
    replaceImage(url)
  }
)

onBeforeUnmount(() => {
  unbindCropperEvents()
  unref(cropperRef)?.destroy()
  cropperRef.value = undefined
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
})

defineExpose({
  cropperExpose: cropperRef,
  getCroppedCanvas
})
</script>

<template>
  <div
    :class="{
      [prefixCls]: true,
      'flex items-center': showResult
    }"
  >
    <div>
      <div ref="containerRef" :style="getBoxStyle" class="cropper-stage flex justify-center items-center" />
      <div v-if="showActions" class="mt-10px flex items-center">
        <div class="flex items-center">
          <ElTooltip content="选择文件" placement="bottom">
            <ElUpload
              action="''"
              accept="image/*"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="uploadChange"
            >
              <BaseButton size="small" type="primary" class="mt-2px"><Icon icon="upload" /></BaseButton>
            </ElUpload>
          </ElTooltip>
        </div>
        <div class="flex items-center justify-end flex-1">
          <ElTooltip content="重置" placement="bottom">
            <BaseButton size="small" type="primary" @click="reset"><Icon icon="refresh-cw" /></BaseButton>
          </ElTooltip>
          <ElTooltip content="逆时针旋转" placement="bottom">
            <BaseButton size="small" type="primary" @click="rotate(-45)"><Icon icon="rotate-ccw" /></BaseButton>
          </ElTooltip>
          <ElTooltip content="顺时针旋转" placement="bottom">
            <BaseButton size="small" type="primary" @click="rotate(45)"><Icon icon="rotate-cw" /></BaseButton>
          </ElTooltip>
          <ElTooltip content="水平翻转" placement="bottom">
            <BaseButton size="small" type="primary" @click="scale('scaleX')"><Icon icon="arrow-up-down" /></BaseButton>
          </ElTooltip>
          <ElTooltip content="垂直翻转" placement="bottom">
            <BaseButton size="small" type="primary" @click="scale('scaleY')"><Icon icon="chevron-down" /></BaseButton>
          </ElTooltip>
          <ElTooltip content="放大" placement="bottom">
            <BaseButton size="small" type="primary" @click="zoom(0.1)"><Icon icon="zoom-in" /></BaseButton>
          </ElTooltip>
          <ElTooltip content="缩小" placement="bottom">
            <BaseButton size="small" type="primary" @click="zoom(-0.1)"><Icon icon="zoom-out" /></BaseButton>
          </ElTooltip>
        </div>
      </div>
    </div>
    <div v-if="imgBase64 && showResult" class="ml-20px">
      <div class="flex justify-center items-center">
        <img :src="imgBase64" class="rounded-[50%]" :style="getCropBoxStyle" />
      </div>
      <ElDivider />
      <div class="flex justify-center items-center">
        <img :src="imgBase64" class="rounded-[50%]" :style="getScaleSize(0.2)" />
        <img :src="imgBase64" class="rounded-[50%] ml-20px" :style="getScaleSize(0.25)" />
        <img :src="imgBase64" class="rounded-[50%] ml-20px" :style="getScaleSize(0.3)" />
        <img :src="imgBase64" class="rounded-[50%] ml-20px" :style="getScaleSize(0.35)" />
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.cropper-stage {
  overflow: hidden;

  :deep(cropper-canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
}
</style>
