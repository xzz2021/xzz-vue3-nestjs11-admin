<script setup lang="tsx">
import type { LogItem } from '@/api/log/type'
import { Descriptions, type DescriptionsSchema } from '@/components/Descriptions'
import { JsonEditor } from '@/components/JsonEditor'
import { useI18n } from '@/hooks/web/useI18n'
import { ElTag } from 'element-plus'
import { computed, type PropType, reactive } from 'vue'

const props = defineProps({
  currentRow: {
    type: Object as PropType<Nullable<LogItem>>,
    default: () => null
  }
})

const { t } = useI18n()

const detailInfo = computed(() => props.currentRow?.detailInfo || {})

const detailSchema = reactive<DescriptionsSchema[]>([
  {
    field: 'user.username',
    label: t('userLog.operator'),
    slots: {
      default: () => <div>{props.currentRow?.user?.username || '-'}</div>
    }
  },
  {
    field: 'user.phone',
    label: t('common.phone'),
    slots: {
      default: () => <div>{props.currentRow?.user?.phone || '-'}</div>
    }
  },
  {
    field: 'isSuccess',
    label: t('userLog.responseStatus'),
    slots: {
      default: () => {
        const isSuccess = props.currentRow?.isSuccess
        return (
          <ElTag type={isSuccess ? 'success' : 'danger'}>{isSuccess ? t('common.success') : t('common.failed')}</ElTag>
        )
      }
    }
  },
  {
    field: 'responseMsg',
    label: t('userLog.responseMsg'),
    slots: {
      default: () => <div>{props.currentRow?.responseMsg || '-'}</div>
    }
  },
  {
    field: 'duration',
    label: t('userLog.duration'),
    slots: {
      default: () => <div>{props.currentRow?.duration != null ? `${props.currentRow.duration}ms` : '-'}</div>
    }
  },

  {
    field: 'method',
    label: t('userLog.method')
  },

  {
    field: 'requestUrl',
    label: t('userLog.path')
  },
  {
    field: 'location',
    label: t('userLog.location'),
    slots: {
      default: () => <div>{props.currentRow?.location || '-'}</div>
    }
  },
  {
    field: 'userAgent',
    label: 'User-Agent'
  },
  {
    field: 'createdAt',
    label: t('userLog.operateTime')
  }
])
</script>

<template>
  <Descriptions :schema="detailSchema" :data="currentRow || {}" />

  <div v-if="Object.keys(detailInfo).length" class="mt-16px">
    <div class="mb-8px text-14px text-[var(--el-text-color-regular)]">{{ t('userLog.detailInfo') }}</div>
    <JsonEditor :model-value="detailInfo" :editable="false" :height="240" />
  </div>
</template>
