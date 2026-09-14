<script setup lang="ts">
import VideoPlayer from '@/components/VideoPlayer/src/VideoPlayer.vue'
import { Icon } from '@/components/Icon'
import { ElMessage, ElOverlay } from 'element-plus'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  url: {
    type: String,
    default: '',
    required: true
  },
  poster: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    default: ''
  }
})

const emit = defineEmits<{
  close: []
  unavailable: []
}>()

const visible = ref(props.show)
const loadFailed = ref(false)

watch(
  () => props.show,
  (show) => {
    visible.value = show
  }
)

watch(
  () => props.url,
  () => {
    loadFailed.value = false
  }
)

const close = async () => {
  visible.value = false
  await nextTick()
  emit('close')
}

const onPlayerError = () => {
  if (loadFailed.value) return
  loadFailed.value = true
  ElMessage.error('视频加载失败，文件可能已失效')
  emit('unavailable')
}

onBeforeUnmount(() => {
  visible.value = false
})
</script>

<template>
  <ElOverlay v-show="visible" @click="close">
    <div class="w-full h-full flex justify-center items-center relative" @click.stop>
      <button
        type="button"
        class="w-44px h-44px color-[#fff] bg-[var(--el-text-color-regular)] rounded-full border-none flex justify-center items-center cursor-pointer absolute top-40px right-40px z-10"
        aria-label="关闭"
        @click.stop="close"
      >
        <Icon icon="x" :size="24" />
      </button>
      <div v-if="loadFailed" class="color-white text-16px px-20px text-center">
        视频无法播放，可关闭后删除无效数据
      </div>
      <VideoPlayer v-else :url="url" :poster="poster" @error="onPlayerError" />
    </div>
  </ElOverlay>
</template>
