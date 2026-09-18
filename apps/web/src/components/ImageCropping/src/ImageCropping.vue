<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { useDesign } from '@/hooks/web/useDesign'
import { useDebounceFn } from '@vueuse/core'
import Cropper from 'cropperjs'
import { ElDivider, ElMessage, ElTooltip, ElUpload, type UploadFile } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import {
  clientRectToCanvasRect,
  getCoverMoveDelta,
  getCoverZoomDelta,
  isRectInside,
  type CropRect
} from './cropper-bounds'

interface TransformEventDetail {
  matrix: number[]
}

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

let skipBoundaryCheck = false

const withoutBoundaryCheck = (fn: () => void) => {
  skipBoundaryCheck = true
  try {
    fn()
  } finally {
    skipBoundaryCheck = false
  }
}

const getSelectionRect = (): CropRect | null => {
  const selection = getCropperSelection()
  if (!selection) return null
  return {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height
  }
}

const getImageCanvasRect = (imageRect?: DOMRect): CropRect | null => {
  const canvas = getCropperCanvas()
  const image = getCropperImage()
  if (!canvas || !image) return null
  return clientRectToCanvasRect(imageRect ?? image.getBoundingClientRect(), canvas.getBoundingClientRect())
}

const coverSelection = () => {
  const image = getCropperImage()
  const selection = getCropperSelection()
  if (!image || !selection) return

  withoutBoundaryCheck(() => {
    const zoomDelta = getCoverZoomDelta(image.getBoundingClientRect(), selection.getBoundingClientRect())
    if (zoomDelta > 0) image.$zoom(zoomDelta)

    const move = getCoverMoveDelta(image.getBoundingClientRect(), selection.getBoundingClientRect())
    if (move.x || move.y) image.$move(move.x, move.y)
  })
}

const applyInitialLayout = () => {
  withoutBoundaryCheck(() => {
    getCropperImage()?.$center('contain')
    resetCropBox()
  })
  coverSelection()
  getBase64()
}

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

const onImageTransform = (event: Event) => {
  if (!skipBoundaryCheck) {
    const canvas = getCropperCanvas()
    const image = getCropperImage()
    const matrix = (event as CustomEvent<TransformEventDetail>).detail?.matrix
    if (canvas && image && matrix) {
      const clone = image.cloneNode() as typeof image
      clone.style.transform = `matrix(${matrix.join(', ')})`
      clone.style.opacity = '0'
      canvas.appendChild(clone)
      const nextRect = clone.getBoundingClientRect()
      canvas.removeChild(clone)
      const maxSelection = getImageCanvasRect(nextRect)
      const selection = getSelectionRect()
      if (maxSelection && selection && !isRectInside(selection, maxSelection)) {
        event.preventDefault()
        return
      }
    }
  }
  onCropChange()
}

const onSelectionChange = (event: Event) => {
  if (!skipBoundaryCheck) {
    const maxSelection = getImageCanvasRect()
    const next = (event as CustomEvent<CropRect>).detail
    if (maxSelection && next && !isRectInside(next, maxSelection)) {
      event.preventDefault()
      return
    }
  }
  onCropChange()
}

const unbindCropperEvents = () => {
  getCropperCanvas()?.removeEventListener('action', onCropChange)
  getCropperCanvas()?.removeEventListener('actionend', onCropChange)
  getCropperSelection()?.removeEventListener('change', onSelectionChange)
  getCropperImage()?.removeEventListener('transform', onImageTransform)
}

const bindCropperEvents = () => {
  getCropperCanvas()?.addEventListener('action', onCropChange)
  getCropperCanvas()?.addEventListener('actionend', onCropChange)
  getCropperSelection()?.addEventListener('change', onSelectionChange)
  getCropperImage()?.addEventListener('transform', onImageTransform)
}

const replaceImage = (url: string) => {
  const image = getCropperImage()
  if (!image) return
  image.crossorigin = 'anonymous'
  image.src = url
  image.$ready(() => {
    applyInitialLayout()
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
    applyInitialLayout()
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
  withoutBoundaryCheck(() => {
    getCropperImage()?.$resetTransform()
    getCropperImage()?.$center('contain')
    getCropperSelection()?.$reset()
    resetCropBox()
  })
  coverSelection()
  getBase64()
}

const rotate = (deg: number) => {
  withoutBoundaryCheck(() => {
    getCropperImage()?.$rotate(`${deg}deg`)
  })
  coverSelection()
  getBase64()
}

const scale = (type: 'scaleX' | 'scaleY') => {
  withoutBoundaryCheck(() => {
    if (type === 'scaleX') {
      getCropperImage()?.$scale(-1, 1)
    } else {
      getCropperImage()?.$scale(1, -1)
    }
  })
  coverSelection()
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
