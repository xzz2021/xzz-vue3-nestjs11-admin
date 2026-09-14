<script setup lang="tsx">
import type { UserItem } from '@/api/user/types'
import { Descriptions, type DescriptionsSchema } from '@/components/Descriptions'
import { useI18n } from '@/hooks/web/useI18n'
import { ElTag } from 'element-plus'
import { computed, type PropType } from 'vue'

const { t } = useI18n()

const props = defineProps({
  currentRow: {
    type: Object as PropType<UserItem | undefined>,
    default: () => undefined,
  },
})

const detailSchema = computed<DescriptionsSchema[]>(() => [
  { field: 'username', label: t('userDemo.username') },
  { field: 'phone', label: t('login.phone') },
  { field: 'email', label: t('userDemo.email') },
  {
    field: 'department.name',
    label: t('userDemo.department'),
  },
  {
    field: 'roles',
    label: t('userDemo.role'),
    slots: {
      default: (data: any) => {
        const roles = data?.row || []
        if (!roles.length) return null
        return (
          <>
            {roles.map((role) => (
              <ElTag key={role.id} class="mr-4px mb-4px">
                {role.name}
              </ElTag>
            ))}
          </>
        )
      },
    },
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    slots: {
      default: () => (
        <ElTag type={props.currentRow?.enabled ? 'success' : 'danger'}>
          {props.currentRow?.enabled ? t('userDemo.enable') : t('userDemo.disable')}
        </ElTag>
      ),
    },
  },
  { field: 'createdAt', label: t('tableDemo.displayTime') },
])
</script>

<template>
  <Descriptions :schema="detailSchema" :data="currentRow || {}" />
</template>
