<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { useUserStore } from '@/store/modules/user'
import { formatFileSize, formatBytes } from '@/utils/file'
import { FileUploadQueue, type UploadQueueItem } from '@/utils/file-upload-queue'
import { ElMessage, ElProgress, ElUpload } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'

const emit = defineEmits<{
  uploaded: []
}>()

const { t } = useI18n()
const userStore = useUserStore()
const userId = computed(() => userStore.getUserInfo?.id || 'anonymous')
const items = reactive<UploadQueueItem[]>([])
const queueRef = ref<FileUploadQueue>()
const toasted = new Set<string>()

const syncItems = () => {
  items.splice(0, items.length, ...(queueRef.value?.items || []))
}

onMounted(async () => {
  const queue = new FileUploadQueue(userId.value, syncItems, () => emit('uploaded'))
  queueRef.value = queue
  await queue.hydrate()
  syncItems()
})

watch(
  items,
  (list) => {
    for (const item of list) {
      if (item.status === 'instant' && !toasted.has(item.localId)) {
        toasted.add(item.localId)
        ElMessage.success(t('file.instantSuccess'))
      }
    }
  },
  { deep: true }
)

const handleFiles = (file: File) => {
  queueRef.value?.addFiles([file])
  return false
}

const statusLabel = (item: UploadQueueItem) => {
  if (item.needsReselect) return t('file.reselect')
  if (item.status === 'hashing') return t('file.hashing')
  if (item.status === 'waiting') return t('file.waiting')
  if (item.status === 'uploading') return t('file.uploading')
  if (item.status === 'paused') return t('file.paused')
  if (item.status === 'instant') return t('file.instant')
  if (item.status === 'success') return t('file.uploadSuccess')
  if (item.status === 'error') return item.error || t('file.uploadFailed')
  return item.status
}

const percent = (item: UploadQueueItem) => {
  if (item.status === 'hashing') {
    return item.totalBytes ? Math.round((item.hashedBytes / item.totalBytes) * 100) : 0
  }
  return item.totalBytes ? Math.round((item.uploadedBytes / item.totalBytes) * 100) : 0
}

const progressStatus = (item: UploadQueueItem) => {
  if (item.status === 'error') return 'exception'
  if (item.status === 'success' || item.status === 'instant') return 'success'
  return undefined
}

const onResume = (item: UploadQueueItem) => {
  if (item.needsReselect) {
    ElMessage.warning(t('file.reselect'))
    return
  }
  queueRef.value?.resume(item.localId)
}

const isFinished = (item: UploadQueueItem) => item.status === 'success' || item.status === 'instant'
</script>

<template>
  <div class="file-upload-queue">
    <ElUpload :show-file-list="false" multiple :before-upload="handleFiles">
      <BaseButton type="primary">{{ t('file.selectFiles') }}</BaseButton>
    </ElUpload>

    <div v-if="items.length" class="mt-12px flex flex-col gap-8px min-w-360px max-w-560px">
      <div
        v-for="item in items"
        :key="item.localId"
        class="border border-solid border-[var(--el-border-color)] rounded-6px px-12px py-8px"
      >
        <div class="flex items-start justify-between gap-8px">
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium leading-22px">{{ item.name }}</div>
            <div class="text-12px leading-18px text-[var(--el-text-color-secondary)]">
              {{ formatFileSize(item.size) }} · {{ statusLabel(item) }}
              <template v-if="item.status === 'uploading' && item.speedBps">
                · {{ formatBytes(item.speedBps) }}/s
              </template>
            </div>
          </div>
          <button
            v-if="isFinished(item)"
            type="button"
            class="shrink-0 mt-2px w-18px h-18px flex items-center justify-center border-none bg-transparent cursor-pointer p-0"
            :title="t('common.close')"
            @click="queueRef?.cancel(item.localId)"
          >
            <Icon
              icon="x"
              :size="14"
              color="var(--el-text-color-placeholder)"
              hover-color="var(--el-text-color-regular)"
            />
          </button>
          <div v-else class="flex items-center gap-8px shrink-0">
            <BaseButton
              v-if="
                !item.needsReselect &&
                (item.status === 'uploading' || item.status === 'waiting' || item.status === 'hashing')
              "
              size="small"
              @click="queueRef?.pause(item.localId)"
            >
              {{ t('file.pause') }}
            </BaseButton>
            <BaseButton
              v-if="!item.needsReselect && (item.status === 'paused' || item.status === 'error')"
              size="small"
              type="primary"
              @click="onResume(item)"
            >
              {{ t('file.resume') }}
            </BaseButton>
            <BaseButton size="small" type="danger" @click="queueRef?.cancel(item.localId)">
              {{ t('file.cancel') }}
            </BaseButton>
          </div>
        </div>
        <ElProgress class="mt-6px" :percentage="percent(item)" :status="progressStatus(item)" :stroke-width="6" />
      </div>
    </div>
  </div>
</template>
