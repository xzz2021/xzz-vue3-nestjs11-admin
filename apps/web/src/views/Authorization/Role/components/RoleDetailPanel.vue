<script setup lang="ts">
import type { RoleDetail } from '@/api/role/type'
import { BaseButton } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { useClipboard } from '@/hooks/web/useClipboard'
import { useI18n } from '@/hooks/web/useI18n'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElMessage, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { computed, type PropType } from 'vue'
import { buildRoleMenuPermissionSnapshot } from '../utils/menuPermissionSnapshot'
import { DATA_SCOPE_I18N, type RoleMenuPermissionItem, type RoleMenuTreeNode } from '../utils/roleMenuTree'

type TagType = 'success' | 'warning' | 'info' | 'primary' | 'danger'

const props = defineProps({
  roleDetail: {
    type: Object as PropType<RoleDetail | undefined>,
    default: undefined
  },
  menuTree: {
    type: Array as PropType<RoleMenuTreeNode[]>,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  edit: []
}>()

const { t } = useI18n()
const { copy } = useClipboard()

const roleInfoItems = computed<Array<{ label: string; value: string; tagType?: TagType }>>(() => {
  const detail = props.roleDetail
  return [
    { label: t('role.roleName'), value: detail?.name || '-' },
    { label: t('role.roleCode'), value: detail?.code || '-' },
    {
      label: t('menu.status'),
      value: detail?.enabled ? t('userDemo.enable') : t('userDemo.disable'),
      tagType: detail?.enabled ? 'success' : 'danger'
    },
    { label: t('userDemo.remark'), value: detail?.description || '-' },
    { label: t('exampleDemo.sort'), value: String(detail?.sort ?? '-') },
    {
      label: t('tableDemo.createdAt'),
      value: detail?.createdAt ? formatToDateTime(detail.createdAt) : '-'
    },
    {
      label: t('tableDemo.updatedAt'),
      value: detail?.updatedAt ? formatToDateTime(detail.updatedAt) : '-'
    },
    { label: t('role.creator'), value: detail?.creatorName || '-' }
  ]
})

const overviewCards = computed(() => [
  {
    key: 'menuCount',
    label: t('role.menuCount'),
    value: props.roleDetail?.menuCount ?? 0,
    icon: 'layout-grid',
    color: '#409eff',
    bg: 'rgba(64, 158, 255, 0.1)'
  },
  {
    key: 'permissionCount',
    label: t('role.buttonPermissionCount'),
    value: props.roleDetail?.permissionCount ?? 0,
    icon: 'lock',
    color: '#67c23a',
    bg: 'rgba(103, 194, 58, 0.1)'
  },
  {
    key: 'userCount',
    label: t('role.ownedUserCount'),
    value: props.roleDetail?.userCount ?? 0,
    icon: 'user',
    color: '#9c27b0',
    bg: 'rgba(156, 39, 176, 0.1)'
  }
])

const isPermissionOwned = (menu: RoleMenuTreeNode, permission: RoleMenuPermissionItem) => {
  return !!menu.checked && permission.enabled && !!permission.checked
}

const dataScopeLabel = (permission: RoleMenuPermissionItem) => {
  if (!permission.dataScope) return t('role.dataScopePending')
  const label = t(DATA_SCOPE_I18N[permission.dataScope])
  return permission.dataScope === 'CUSTOM_DEFINE'
    ? t('role.customDepartmentCountLabel', { scope: label, count: permission.departmentIds.length })
    : label
}

const handleCopyMenuPermission = () => {
  const snapshot = buildRoleMenuPermissionSnapshot(props.menuTree)
  if (!snapshot.menus.length) {
    ElMessage.warning(t('role.copyMenuPermissionEmpty'))
    return
  }
  copy(JSON.stringify(snapshot, null, 2))
}
</script>

<template>
  <div v-loading="loading" class="role-detail">
    <div class="role-info-section mb-20px">
      <div class="role-info-header">
        <span class="section-title">{{ t('role.roleInfo') }}</span>
        <BaseButton type="primary" @click="emit('edit')">
          <Icon icon="pen-line" class="mr-4px" />
          {{ t('role.editRole') }}
        </BaseButton>
      </div>
      <div class="role-info-grid">
        <div v-for="item in roleInfoItems" :key="item.label" class="role-info-item">
          <span class="role-info-label">{{ item.label }}</span>
          <ElTag v-if="item.tagType" :type="item.tagType" size="small">{{ item.value }}</ElTag>
          <span v-else class="role-info-value">{{ item.value }}</span>
        </div>
      </div>
      <div class="overview-grid">
        <div v-for="card in overviewCards" :key="card.key" class="overview-card">
          <div class="overview-icon" :style="{ backgroundColor: card.bg, color: card.color }">
            <Icon :icon="card.icon" :size="22" />
          </div>
          <div class="overview-content">
            <div class="overview-label">{{ card.label }}</div>
            <div class="overview-value">{{ card.value }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-card">
      <div class="card-header mb-16px">
        <span class="card-title">{{ t('role.menuPermissionDetail') }}</span>
        <div class="card-header-actions">
          <div class="legend">
            <span class="legend-item">
              <Icon icon="circle-check" class="legend-owned" :size="16" />
              {{ t('role.owned') }}
            </span>
            <span class="legend-item">
              <Icon icon="ban" class="legend-unowned" :size="16" />
              {{ t('role.notOwned') }}
            </span>
          </div>
          <BaseButton @click="handleCopyMenuPermission" type="success">
            <Icon icon="copy" class="mr-4px" />
            {{ t('role.copyMenuPermission') }}
          </BaseButton>
        </div>
      </div>

      <ElTable
        :data="menuTree"
        row-key="id"
        default-expand-all
        :tree-props="{ children: 'children' }"
        border
        class="menu-permission-table"
      >
        <ElTableColumn :label="t('menu.name')" min-width="260">
          <template #default="{ row }">
            <div class="menu-name-cell">
              <Icon
                :icon="row.checked ? 'circle-check' : 'ban'"
                :class="row.checked ? 'menu-owned-icon' : 'menu-unowned-icon'"
                :size="16"
              />
              <span>{{ t(row.title) }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="t('role.ownedPermissions')" min-width="420">
          <template #default="{ row }">
            <div v-if="row.permissions?.length" class="permission-tags">
              <div v-for="permission in row.permissions" :key="permission.id" class="permission-display">
                <ElTag
                  :type="isPermissionOwned(row, permission) ? 'success' : 'info'"
                  :effect="isPermissionOwned(row, permission) ? 'light' : 'plain'"
                  class="permission-tag"
                >
                  {{ permission.name }}
                </ElTag>
                <template v-if="isPermissionOwned(row, permission) && permission.scopeEnabled">
                  <ElTag :type="permission.dataScope ? 'primary' : 'warning'" effect="plain">
                    {{ dataScopeLabel(permission) }}
                  </ElTag>
                  <ElTag v-if="permission.disabledDepartmentIds.length" type="danger" effect="plain">
                    {{
                      t('role.invalidDepartmentCount', {
                        count: permission.disabledDepartmentIds.length
                      })
                    }}
                  </ElTag>
                </template>
              </div>
            </div>
            <span v-else class="text-gray-400">-</span>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>
  </div>
</template>

<style scoped lang="less">
.role-detail {
  .role-info-section {
    padding-bottom: 4px;
  }

  .role-info-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .role-info-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px 24px;
  }

  .role-info-item {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    font-size: 14px;
    line-height: 22px;
  }

  .role-info-label {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);

    &::after {
      content: '：';
    }
  }

  .role-info-value {
    overflow: hidden;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 20px;
  }

  .overview-card {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .overview-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }

  .overview-label {
    margin-bottom: 4px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .overview-value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .detail-card {
    padding: 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .card-header-actions {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .legend {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .legend-item {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  .legend-owned {
    color: var(--el-color-success);
  }

  .legend-unowned {
    color: var(--el-text-color-placeholder);
  }

  .menu-name-cell {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    line-height: 22px;
    vertical-align: middle;

    :deep(.el-icon) {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    :deep(.iconify) {
      display: block;
      line-height: 1;
    }

    > span {
      line-height: 22px;
    }
  }

  .menu-owned-icon {
    color: var(--el-color-success);
  }

  .menu-unowned-icon {
    color: var(--el-text-color-placeholder);
  }

  .permission-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .permission-display {
    display: inline-flex;
    max-width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;

    :deep(.el-tag) {
      height: auto;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }

  .permission-tag {
    margin: 0;
  }

  .menu-permission-table {
    :deep(.el-table__body tr td:first-child .cell) {
      display: flex;
      align-items: center;
    }
  }
}

@media (width <= 900px) {
  .role-detail {
    .role-info-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .role-info-header,
    .card-header,
    .card-header-actions,
    .legend {
      flex-wrap: wrap;
    }
  }
}

@media (width <= 600px) {
  .role-detail {
    .role-info-grid,
    .overview-grid {
      grid-template-columns: 1fr;
    }

    .card-header {
      gap: 12px;
    }

    .card-header-actions {
      width: 100%;
    }
  }
}
</style>
