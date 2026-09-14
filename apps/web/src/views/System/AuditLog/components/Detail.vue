<script setup lang="tsx">
import type { AuditLogItem } from '@/api/log/type'
import { Descriptions, type DescriptionsSchema } from '@/components/Descriptions'
import { JsonEditor } from '@/components/JsonEditor'
import { useI18n } from '@/hooks/web/useI18n'
import { ElTag } from 'element-plus'
import { computed, type PropType, reactive } from 'vue'

const props = defineProps({
  currentRow: {
    type: Object as PropType<Nullable<AuditLogItem>>,
    default: () => null
  }
})

const { t } = useI18n()

const metadata = computed(() => props.currentRow?.metadata || {})

const actionLabel = (action?: string) => {
  if (!action) return '-'
  const key = `auditLog.actions.${action}`
  const label = t(key)
  return label === key ? action : label
}

const detailSchema = reactive<DescriptionsSchema[]>([
  {
    field: 'user.username',
    label: t('auditLog.operator'),
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
    field: 'action',
    label: t('auditLog.action'),
    slots: {
      default: () => <div>{actionLabel(props.currentRow?.action)}</div>
    }
  },
  {
    field: 'resource',
    label: t('auditLog.resource')
  },
  {
    field: 'resourceId',
    label: t('auditLog.resourceId'),
    slots: {
      default: () => <div>{props.currentRow?.resourceId || '-'}</div>
    }
  },
  {
    field: 'success',
    label: t('auditLog.result'),
    slots: {
      default: () => {
        const success = props.currentRow?.success
        return <ElTag type={success ? 'success' : 'danger'}>{success ? t('common.success') : t('common.failed')}</ElTag>
      }
    }
  },
  {
    field: 'location',
    label: t('auditLog.location'),
    slots: {
      default: () => <div>{props.currentRow?.location || '-'}</div>
    }
  },
  {
    field: 'createdAt',
    label: t('auditLog.operateTime')
  }
])
</script>

<template>
  <Descriptions :schema="detailSchema" :data="currentRow || {}" />

  <div v-if="Object.keys(metadata).length" class="mt-16px">
    <div class="mb-8px text-14px text-[var(--el-text-color-regular)]">{{ t('auditLog.metadata') }}</div>
    <JsonEditor :model-value="metadata" :editable="false" :height="240" />
  </div>
</template>
