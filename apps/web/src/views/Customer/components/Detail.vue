<script setup lang="tsx">
import type { CustomerItem } from '@/api/customer/type'
import { Descriptions, type DescriptionsSchema } from '@/components/Descriptions'
import { useI18n } from '@/hooks/web/useI18n'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElTag } from 'element-plus'
import { computed, type PropType } from 'vue'
import { statusTagType } from '../utils/customer'

const { t } = useI18n()

const props = defineProps({
  currentRow: {
    type: Object as PropType<CustomerItem | undefined>,
    default: () => undefined,
  },
  departmentName: {
    type: String,
    default: '',
  },
  ownerName: {
    type: String,
    default: '',
  },
})

const detailData = computed(() => {
  const row = props.currentRow
  if (!row) return {}
  return {
    ...row,
    departmentName: props.departmentName || row.departmentId,
    ownerName: props.ownerName || row.ownerId,
    createdAtText: formatToDateTime(row.createdAt),
    updatedAtText: formatToDateTime(row.updatedAt),
  }
})

const detailSchema = computed<DescriptionsSchema[]>(() => {
  const schema: DescriptionsSchema[] = [
    { field: 'name', label: t('customer.name') },
    { field: 'phone', label: t('customer.phone') },
    {
      field: 'status',
      label: t('customer.statusLabel'),
      slots: {
        default: () => {
          const status = props.currentRow?.status
          if (!status) return null
          return <ElTag type={statusTagType(status)}>{t(`customer.status.${status}`)}</ElTag>
        },
      },
    },
    { field: 'dealAmount', label: t('customer.dealAmount') },
  ]

  if (props.currentRow && 'internalCost' in props.currentRow && props.currentRow.internalCost !== undefined) {
    schema.push({ field: 'internalCost', label: t('customer.internalCost') })
  }

  schema.push(
    {
      field: 'confidential',
      label: t('customer.confidential'),
      slots: {
        default: () => (
          <ElTag type={props.currentRow?.confidential ? 'warning' : 'info'}>
            {props.currentRow?.confidential ? t('customer.yes') : t('customer.no')}
          </ElTag>
        ),
      },
    },
    { field: 'departmentName', label: t('customer.department') },
    { field: 'ownerName', label: t('customer.owner') },
    { field: 'remark', label: t('customer.remark') },
    { field: 'createdAtText', label: t('customer.createdAt') },
    { field: 'updatedAtText', label: t('customer.updatedAt') },
  )

  return schema
})
</script>

<template>
  <Descriptions :schema="detailSchema" :data="detailData" />
</template>
