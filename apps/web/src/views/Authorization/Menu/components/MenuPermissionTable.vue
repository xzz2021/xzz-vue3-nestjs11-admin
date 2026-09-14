<script setup lang="ts">
import type { MenuPermission, PermissionType } from '@/api/menu/types'
import { BaseButton } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { ElButton, ElPopconfirm, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { getPermissionCodeSuffix } from '../utils/permissionCode'

defineProps<{
  permissions: MenuPermission[]
  menuPath?: string
  editMode: boolean
  importing: boolean
}>()

const emit = defineEmits<{
  add: []
  edit: [row: MenuPermission]
  delete: [row: MenuPermission]
  copy: []
  import: []
}>()

const { t } = useI18n()

const permissionTypeLabel = (type: PermissionType) => {
  const map: Record<PermissionType, string> = {
    BUTTON: t('menu.permissionTypeButton'),
    DATA: t('menu.permissionTypeData'),
    API: t('menu.permissionTypeApi'),
    OTHER: t('menu.permissionTypeOther')
  }
  return map[type] ?? type
}
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-8px items-center mt-5px">
      <BaseButton type="primary" size="small" @click="emit('add')">
        {{ t('menu.addPermission') }}
      </BaseButton>
      <BaseButton size="small" @click="emit('copy')">
        <Icon icon="copy" class="mr-4px" />
        {{ t('menu.copyPermission') }}
      </BaseButton>
      <BaseButton size="small" :disabled="!editMode" :loading="importing" @click="emit('import')">
        <Icon icon="clipboard-paste" class="mr-4px" />
        {{ t('menu.importPermission') }}
      </BaseButton>
    </div>
    <ElTable :key="JSON.stringify(permissions.map((item) => item.id))" :data="permissions" class="mt-10px">
      <ElTableColumn type="index" width="50" />
      <ElTableColumn prop="name" :label="t('common.name')" />
      <ElTableColumn prop="code" :label="t('common.code')">
        <template #default="{ row }">
          <span :title="row.code">{{ getPermissionCodeSuffix(row.code, menuPath) }}</span>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="type" :label="t('common.type')" width="100">
        <template #default="{ row }">
          <ElTag size="small">{{ permissionTypeLabel(row.type) }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="enabled" :label="t('menu.status')" width="80">
        <template #default="{ row }">
          <ElTag :type="row.enabled ? 'success' : 'danger'" size="small">
            {{ row.enabled ? t('userDemo.enable') : t('userDemo.disable') }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="scopeEnabled" :label="t('menu.scopeEnabled')" width="100">
        <template #default="{ row }">
          <ElTag :type="row.scopeEnabled ? 'success' : 'info'" size="small">
            {{ row.scopeEnabled ? t('menu.scopeEnabledOn') : t('menu.scopeEnabledOff') }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn :label="t('userDemo.action')" width="140">
        <template #default="{ row }">
          <ElButton size="small" type="primary" @click="emit('edit', row)">
            {{ t('common.edit') }}
          </ElButton>
          <ElPopconfirm :title="t('menu.confirmDeletePermission')" @confirm="emit('delete', row)">
            <template #reference>
              <ElButton size="small" type="danger">{{ t('exampleDemo.del') }}</ElButton>
            </template>
          </ElPopconfirm>
        </template>
      </ElTableColumn>
    </ElTable>
  </div>
</template>
