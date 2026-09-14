<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { ElUpload, type ButtonType } from 'element-plus'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    uploadApi: (file: File) => Promise<void>
    text?: string
    type?: ButtonType
  }>(),
  {
    type: 'primary'
  }
)

const loading = ref(false)

const beforeUpload = (file: File) => {
  loading.value = true
  props
    .uploadApi(file)
    .catch(() => undefined)
    .finally(() => {
      loading.value = false
    })
  return false
}
</script>

<template>
  <ElUpload :show-file-list="false" :before-upload="beforeUpload" :disabled="loading">
    <BaseButton :type="type" :loading="loading">
      <slot>{{ text || t('formDemo.upload') }}</slot>
    </BaseButton>
  </ElUpload>
</template>
