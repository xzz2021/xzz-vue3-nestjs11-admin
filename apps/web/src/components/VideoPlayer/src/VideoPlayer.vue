<script setup lang="ts">
import Player from 'xgplayer'
import { nextTick, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import 'xgplayer/dist/index.min.css'

const props = defineProps({
  url: {
    type: String,
    default: '',
    required: true
  },
  poster: {
    type: String,
    default: ''
  }
})

const emit = defineEmits<{
  error: [error?: unknown]
}>()

const playerRef = ref<Player>()
const videoEl = ref<HTMLDivElement>()

const bindError = (player: Player) => {
  player.on('error', (err: unknown) => {
    emit('error', err)
  })
}

const intiPlayer = () => {
  if (!unref(videoEl) || !props.url) return
  playerRef.value = new Player({
    autoplay: false,
    url: props.url,
    poster: props.poster,
    el: unref(videoEl)!
  })
  bindError(playerRef.value)
}

onMounted(() => {
  intiPlayer()
})

watch(
  () => [props.url, props.poster] as const,
  async () => {
    await nextTick()
    unref(playerRef)?.destroy()
    playerRef.value = undefined
    intiPlayer()
  }
)

onBeforeUnmount(() => {
  unref(playerRef)?.destroy()
  playerRef.value = undefined
})

defineExpose({
  playerExpose: () => unref(playerRef)
})
</script>

<template>
  <div ref="videoEl"></div>
</template>
