<script setup lang="ts">
import type { OssConfig } from '@/api/oss/types'
import { BaseButton } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { formatBytes, formatFileSize } from '@/utils/file'
import { OssConflictError, uploadOssFile } from '@/utils/oss-upload'
import { ElMessage, ElMessageBox, ElProgress } from 'element-plus'
import { reactive, watch } from 'vue'

export interface OssQueueFile {
  file: File
  prefix: string
  filename: string
}

type QueueStatus = 'waiting' | 'uploading' | 'success' | 'error' | 'skipped'

interface QueueItem extends OssQueueFile {
  id: string
  status: QueueStatus
  uploadedBytes: number
  error?: string
  controller: AbortController
}

const props = defineProps<{
  files: OssQueueFile[]
  config: OssConfig
}>()

const emit = defineEmits<{
  uploaded: []
}>()

const { t } = useI18n()
const items = reactive<QueueItem[]>([])

const enqueue = (incoming: OssQueueFile[]) => {
  for (const item of incoming) {
    items.push({
      ...item,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: 'waiting',
      uploadedBytes: 0,
      controller: new AbortController()
    })
  }
  void drain()
}

watch(
  () => props.files,
  (next) => {
    if (next.length) enqueue(next)
  }
)

const drain = async () => {
  const next = items.find((item) => item.status === 'waiting')
  if (!next) return
  next.status = 'uploading'
  const run = async (overwrite: boolean) => {
    await uploadOssFile({
      file: next.file,
      prefix: next.prefix,
      filename: next.filename,
      overwrite,
      config: props.config,
      signal: next.controller.signal,
      onProgress: (uploaded) => {
        next.uploadedBytes = uploaded
      }
    })
  }
  try {
    await run(false)
    next.status = 'success'
    next.uploadedBytes = next.file.size
    emit('uploaded')
  } catch (error) {
    if (next.controller.signal.aborted) {
      next.status = 'skipped'
      return drain()
    }
    if (error instanceof OssConflictError) {
      try {
        await ElMessageBox.confirm(t('oss.overwriteConfirm'), next.filename, { type: 'warning' })
        await run(true)
        next.status = 'success'
        next.uploadedBytes = next.file.size
        emit('uploaded')
      } catch {
        next.status = 'skipped'
      }
    } else {
      next.status = 'error'
      next.error = error instanceof Error ? error.message : t('oss.uploadFailed')
      ElMessage.error(next.error)
    }
  }
  await drain()
}

const cancel = (id: string) => {
  const item = items.find((row) => row.id === id)
  if (!item) return
  item.controller.abort()
  if (item.status === 'waiting') item.status = 'skipped'
  if (item.status === 'success' || item.status === 'error' || item.status === 'skipped') {
    const index = items.findIndex((row) => row.id === id)
    if (index >= 0) items.splice(index, 1)
  }
}

const percent = (item: QueueItem) => (item.file.size ? Math.round((item.uploadedBytes / item.file.size) * 100) : 0)
</script>

<template>
  <div v-if="items.length" class="mb-12px flex flex-col gap-8px min-w-360px max-w-560px">
    <div
      v-for="item in items"
      :key="item.id"
      class="border border-solid border-[var(--el-border-color)] rounded-6px px-12px py-8px"
    >
      <div class="flex items-start justify-between gap-8px">
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium leading-22px">{{ item.filename }}</div>
          <div class="text-12px leading-18px text-[var(--el-text-color-secondary)]">
            {{ formatFileSize(item.file.size) }} ·
            {{
              item.status === 'uploading'
                ? t('file.uploading')
                : item.status === 'success'
                  ? t('file.uploadSuccess')
                  : item.status === 'skipped'
                    ? t('oss.skipped')
                    : item.status === 'error'
                      ? item.error || t('file.uploadFailed')
                      : t('file.waiting')
            }}
            <template v-if="item.status === 'uploading'"> · {{ formatBytes(item.uploadedBytes) }}</template>
          </div>
        </div>
        <button
          v-if="item.status === 'success' || item.status === 'skipped' || item.status === 'error'"
          type="button"
          class="shrink-0 mt-2px w-18px h-18px flex items-center justify-center border-none bg-transparent cursor-pointer p-0"
          @click="cancel(item.id)"
        >
          <Icon icon="x" :size="14" color="var(--el-text-color-placeholder)" />
        </button>
        <BaseButton v-else size="small" type="danger" @click="cancel(item.id)">{{ t('file.cancel') }}</BaseButton>
      </div>
      <ElProgress
        class="mt-6px"
        :percentage="percent(item)"
        :status="item.status === 'error' ? 'exception' : item.status === 'success' ? 'success' : undefined"
        :stroke-width="6"
      />
    </div>
  </div>
</template>
