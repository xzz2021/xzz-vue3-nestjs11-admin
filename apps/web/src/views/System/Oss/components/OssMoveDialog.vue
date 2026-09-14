<script setup lang="ts">
import { getOssListApi } from '@/api/oss'
import type { OssFolderItem } from '@/api/oss/types'
import { BaseButton } from '@/components/Button'
import { useI18n } from '@/hooks/web/useI18n'
import { breadcrumbSegments } from '@/utils/dangerousFilename'
import { ElDialog, ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  currentPrefix: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [destinationPrefix: string]
}>()

const { t } = useI18n()
const browsing = ref('')
const folders = ref<OssFolderItem[]>([])
const loading = ref(false)

const crumbs = computed(() => breadcrumbSegments(browsing.value))

const load = async () => {
  loading.value = true
  try {
    const res = await getOssListApi({ prefix: browsing.value })
    folders.value = res.data.folders
  } catch {
    ElMessage.error(t('oss.loadFailed'))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      browsing.value = props.currentPrefix
      void load()
    }
  }
)

const close = () => emit('update:modelValue', false)

const confirm = () => {
  emit('confirm', browsing.value)
}
</script>

<template>
  <ElDialog :model-value="modelValue" :title="t('oss.move')" width="480px" @close="close">
    <div class="mb-12px text-13px">
      <span
        class="cursor-pointer"
        @click="
          browsing = ''
          load()
        "
        >{{ t('oss.root') }}</span
      >
      <span v-for="item in crumbs" :key="item.prefix">
        /
        <span
          class="cursor-pointer"
          @click="
            browsing = item.prefix
            load()
          "
          >{{ item.name }}</span
        >
      </span>
    </div>
    <div v-loading="loading" class="min-h-180px">
      <div
        v-for="folder in folders"
        :key="folder.prefix"
        class="py-6px cursor-pointer hover:bg-[var(--el-fill-color-light)] px-8px rounded-4px"
        @click="
          browsing = folder.prefix
          load()
        "
      >
        {{ folder.name }}
      </div>
      <div v-if="!folders.length && !loading" class="text-[var(--el-text-color-secondary)]">{{ t('oss.empty') }}</div>
    </div>
    <template #footer>
      <BaseButton @click="close">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" @click="confirm">{{ t('common.ok') }}</BaseButton>
    </template>
  </ElDialog>
</template>
