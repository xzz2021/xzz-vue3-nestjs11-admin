<script setup lang="ts">
import { Icon } from '@/components/Icon'
import { useDraggable, useElementSize, useWindowSize } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface AudioPlayerProps {
  url: string
  poster?: string
  id?: string
  filename?: string
  show?: boolean
}

const props = withDefaults(defineProps<AudioPlayerProps>(), {
  poster: '',
  id: '',
  filename: '',
  show: true
})

const emit = defineEmits<{
  close: []
  unavailable: []
}>()

const audioEl = ref<HTMLAudioElement>()
const audioRef = ref<HTMLElement>()
const visible = ref(props.show)
const loadFailed = ref(false)

const { width: windowWidth, height: windowHeight } = useWindowSize()
const { width: boxWidth, height: boxHeight } = useElementSize(audioRef)

const PANEL_WIDTH = 320
const PANEL_HEIGHT = 120

const readStoredPosition = () => {
  try {
    const stored = localStorage.getItem('AudioDialogXY')
    if (!stored) return null
    const { top, left } = JSON.parse(stored)
    if (typeof top === 'number' && typeof left === 'number') {
      return { x: left, y: top }
    }
  } catch {
    // ignore broken storage
  }
  return null
}

const clampPosition = (x: number, y: number, width: number, height: number) => {
  const maxX = Math.max(0, windowWidth.value - width)
  const maxY = Math.max(0, windowHeight.value - height)
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY)
  }
}

const defaultPosition = () =>
  clampPosition(
    (windowWidth.value - PANEL_WIDTH) / 2,
    Math.max(80, windowHeight.value / 4 - PANEL_HEIGHT / 2),
    PANEL_WIDTH,
    PANEL_HEIGHT
  )

const stored = readStoredPosition()
const { x, y } = useDraggable(audioRef, {
  initialValue: stored ? clampPosition(stored.x, stored.y, PANEL_WIDTH, PANEL_HEIGHT) : defaultPosition(),
  preventDefault: true
})

const audioStyle = computed(() => {
  const width = boxWidth.value || PANEL_WIDTH
  const height = boxHeight.value || PANEL_HEIGHT
  const pos = clampPosition(x.value, y.value, width, height)
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    width: `${PANEL_WIDTH}px`
  }
})

const setStorage = () => {
  localStorage.setItem(
    'AudioDialogXY',
    JSON.stringify({
      top: y.value,
      left: x.value
    })
  )
}

const close = () => {
  setStorage()
  audioEl.value?.pause()
  visible.value = false
  emit('close')
}

const onAudioError = () => {
  if (loadFailed.value) return
  loadFailed.value = true
  audioEl.value?.pause()
  ElMessage.error('音频加载失败，文件可能已失效')
  emit('unavailable')
}

watch(
  () => props.url,
  () => {
    loadFailed.value = false
  }
)

watch(
  () => props.show,
  (show) => {
    visible.value = show
    if (!show) {
      audioEl.value?.pause()
    }
  }
)

onMounted(() => {
  // 尺寸就绪后再次钳制，避免首次渲染宽高为 0 导致跑出视口
  const width = boxWidth.value || PANEL_WIDTH
  const height = boxHeight.value || PANEL_HEIGHT
  const pos = clampPosition(x.value, y.value, width, height)
  x.value = pos.x
  y.value = pos.y
})

onBeforeUnmount(() => {
  setStorage()
  audioEl.value?.pause()
})
</script>

<template>
  <div v-show="visible" ref="audioRef" class="audio-player bg-[var(--el-color-primary)] text-white" :style="audioStyle">
    <div class="p-10px">
      <div class="flex justify-between items-center gap-2">
        <div class="overflow-hidden max-w-[240px] flex-1">
          <div class="whitespace-nowrap text-ellipsis overflow-hidden">
            {{ filename || '未知音频' }}
          </div>
        </div>
        <button
          type="button"
          class="audio-close cursor-pointer hover:bg-#30a19d rounded-full flex items-center justify-center border-none bg-transparent text-white"
          aria-label="关闭"
          @pointerdown.stop
          @click.stop="close"
        >
          <Icon icon="x" style="width: 24px; height: 24px" />
        </button>
      </div>
      <div class="mt-2">
        <audio
          v-if="!loadFailed"
          ref="audioEl"
          :src="url"
          controls
          preload="metadata"
          class="w-full"
          @error="onAudioError"
          @pointerdown.stop
        ></audio>
        <div v-else class="text-13px leading-5 opacity-90">文件无法播放，可关闭后删除无效数据</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-player {
  position: fixed;
  z-index: 9999;
  cursor: move;
  border-radius: 8px;
  box-shadow: 0 2px 12px #0000001a;
  user-select: none;
}

.audio-close {
  width: 28px;
  height: 28px;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
