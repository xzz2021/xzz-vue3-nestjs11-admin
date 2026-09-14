<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { useClipboard } from '@/hooks/web/useClipboard'
import { useI18n } from '@/hooks/web/useI18n'
import { useDepartmentStore } from '@/store/modules/department'
import { eachTree } from '@/utils/tree'
import {
  ElCheckbox,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElSwitch,
  ElTag,
  ElTooltip,
  ElTree
} from 'element-plus'
import { computed, nextTick, type PropType, ref, watch } from 'vue'
import { applyRoleMenuPermissionSnapshot, parseRoleMenuPermissionSnapshot } from '../utils/menuPermissionSnapshot'
import {
  clearPermissionSelection,
  collectEchoCheckedKeys,
  collectRoleSubmitData,
  filterRoleMenuNode,
  findFirstMenuNode,
  findFirstRoleScopeIssue,
  getMenuPermissionCount,
  groupPermissionsByType,
  ROLE_PERMISSION_TYPE_I18N,
  type RoleFormModel,
  type RoleMenuPermissionItem,
  type RoleMenuTreeNode
} from '../utils/roleMenuTree'
import DataScopeEditor from './DataScopeEditor.vue'

const emit = defineEmits<{
  cancel: []
  save: []
}>()

const treeRef = ref<InstanceType<typeof ElTree>>()
const menuSearch = ref('')
const currentMenu = ref<RoleMenuTreeNode>()
const isExpandAll = ref(true)
const permissionChangeTick = ref(0)
const syncingTreeCheckedState = ref(false)

const { t } = useI18n()
const { getText } = useClipboard()
const departmentStore = useDepartmentStore()

const props = defineProps({
  menuTree: {
    type: Array as PropType<RoleMenuTreeNode[]>,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  saveLoading: {
    type: Boolean,
    default: false
  }
})

const roleFormModel = defineModel<RoleFormModel>('roleForm', { required: true })

watch(menuSearch, (value) => {
  treeRef.value?.filter(value)
})

const bumpPermissionChange = () => {
  permissionChangeTick.value++
}

const clearMenuPermissions = (node: RoleMenuTreeNode) => {
  node.permissions.forEach(clearPermissionSelection)
}

const syncMenuCheckedState = () => {
  const checkedKeys = new Set(treeRef.value?.getCheckedKeys(false) || [])
  let changed = false
  eachTree(props.menuTree, (node) => {
    const checked = checkedKeys.has(node.id)
    if (node.checked === checked) return
    if (!checked) clearMenuPermissions(node)
    node.checked = checked
    changed = true
  })
  if (changed) bumpPermissionChange()
}

const runWithTreeSync = (fn: () => void) => {
  syncingTreeCheckedState.value = true
  try {
    fn()
  } finally {
    syncingTreeCheckedState.value = false
  }
}

const applyTreeCheckedKeys = (checkedIds: string[]) => {
  runWithTreeSync(() => {
    treeRef.value?.setCheckedKeys(checkedIds, false)
    syncMenuCheckedState()
  })
}

const checkMenuNode = (node: RoleMenuTreeNode) => {
  if (node.checked) return
  runWithTreeSync(() => {
    treeRef.value?.setChecked(node.id, true, false)
    syncMenuCheckedState()
  })
}

const handleCheckChange = () => {
  if (syncingTreeCheckedState.value) return
  syncMenuCheckedState()
}

watch(
  () => props.menuTree,
  async (tree) => {
    if (!tree.length) {
      currentMenu.value = undefined
      return
    }
    await nextTick()
    applyTreeCheckedKeys(collectEchoCheckedKeys(tree))
    if (!currentMenu.value) {
      currentMenu.value = findFirstMenuNode(tree)
    }
  },
  { immediate: true }
)

const handleNodeClick = (node: RoleMenuTreeNode) => {
  currentMenu.value = node
}

const selectedMenuCount = computed(() => {
  let count = 0
  eachTree(props.menuTree, (node) => {
    if (node.checked) count++
  })
  return count
})

const selectedPermissionCount = computed(() => {
  permissionChangeTick.value
  let count = 0
  eachTree(props.menuTree, (node) => {
    node.permissions.forEach((permission) => {
      if (permission.enabled && permission.checked) count++
    })
  })
  return count
})

const menuPermissionCountMap = computed(() => {
  permissionChangeTick.value
  const map: Record<string, { text: string; selected: number }> = {}
  eachTree(props.menuTree, (node) => {
    const { selected, total } = getMenuPermissionCount(node)
    map[node.id] = {
      selected,
      text: total > 0 ? `${selected}/${total}` : '0'
    }
  })
  return map
})

const currentMenuPermissions = computed(() => currentMenu.value?.permissions || [])

const permissionGroups = computed(() =>
  groupPermissionsByType(currentMenuPermissions.value).map((group) => ({
    ...group,
    label: t(ROLE_PERMISSION_TYPE_I18N[group.type] || ROLE_PERMISSION_TYPE_I18N.OTHER)
  }))
)

const isCurrentMenuAllChecked = computed(() => {
  const permissions = currentMenuPermissions.value.filter((permission) => permission.enabled)
  return permissions.length > 0 && permissions.every((item) => item.checked)
})

const toggleCurrentMenuPermissions = (checked: boolean) => {
  currentMenuPermissions.value.forEach((permission) => {
    if (!permission.enabled) return
    if (checked) {
      permission.checked = true
    } else {
      clearPermissionSelection(permission)
    }
  })
  bumpPermissionChange()
  if (checked && currentMenu.value) {
    checkMenuNode(currentMenu.value)
  }
}

const togglePermission = (permission: RoleMenuPermissionItem, checked: boolean) => {
  if (!permission.enabled) return
  if (checked) {
    permission.checked = true
  } else {
    clearPermissionSelection(permission)
  }
  bumpPermissionChange()
  if (checked && currentMenu.value) {
    checkMenuNode(currentMenu.value)
  }
}

const toggleExpandAll = () => {
  isExpandAll.value = !isExpandAll.value
  const nodes = treeRef.value?.store?.nodesMap
  if (!nodes) return
  Object.values(nodes).forEach((node: { expanded: boolean }) => {
    node.expanded = isExpandAll.value
  })
}

const syncTreeCheckedKeys = () => {
  applyTreeCheckedKeys(collectEchoCheckedKeys(props.menuTree))
}

const isAllMenuPermissionChecked = computed(() => {
  permissionChangeTick.value
  let hasMenu = false
  let allChecked = true
  eachTree(props.menuTree, (node: RoleMenuTreeNode) => {
    hasMenu = true
    if (!node.checked || node.permissions.some((permission) => permission.enabled && !permission.checked)) {
      allChecked = false
    }
  })
  return hasMenu && allChecked
})

const toggleAllMenuPermissions = () => {
  const checked = !isAllMenuPermissionChecked.value
  eachTree(props.menuTree, (node: RoleMenuTreeNode) => {
    node.checked = checked
    node.permissions.forEach((permission) => {
      if (!permission.enabled) return
      if (checked) {
        permission.checked = true
      } else {
        clearPermissionSelection(permission)
      }
    })
  })
  syncTreeCheckedKeys()
}

const handleImportPermissions = async () => {
  const clipboardText = await getText()
  if (!clipboardText?.trim()) {
    ElMessage.warning(t('role.importPermissionEmpty'))
    return
  }

  const snapshot = parseRoleMenuPermissionSnapshot(clipboardText.trim())
  if (!snapshot) {
    ElMessage.error(t('role.importPermissionInvalid'))
    return
  }

  try {
    await ElMessageBox.confirm(t('role.importPermissionConfirm'), t('common.reminder'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  const { matchedMenuCount, matchedPermissionCount } = applyRoleMenuPermissionSnapshot(props.menuTree, snapshot)
  if (!matchedMenuCount && !matchedPermissionCount) {
    ElMessage.warning(t('role.importPermissionNoMatch'))
    return
  }

  await nextTick()
  syncTreeCheckedKeys()

  if (snapshot.version === 1) {
    ElMessage.warning(t('role.legacySnapshotScopeWarning'))
  }

  ElMessage.success(
    t('role.importPermissionSuccess', {
      menuCount: matchedMenuCount,
      permissionCount: matchedPermissionCount
    })
  )
}

const scopeValidationMessageKey = {
  required: 'role.dataScopeSaveRequired',
  customRequired: 'role.customDepartmentSaveRequired',
  invalidDepartments: 'role.invalidDepartmentSaveBlocked',
  departmentUnavailable: 'role.departmentUnavailableSaveBlocked',
  nonCustomDepartments: 'role.nonCustomDepartmentSaveBlocked'
} as const

const collectSubmitData = async () => {
  await departmentStore.ensureList()
  const issue = findFirstRoleScopeIssue(props.menuTree, {
    departments: departmentStore.list,
    departmentLoaded: departmentStore.loaded,
    departmentLoadError: departmentStore.loadError
  })
  if (issue) {
    currentMenu.value = issue.menu
    treeRef.value?.setCurrentKey(issue.menu.id)
    ElMessage.warning(t(scopeValidationMessageKey[issue.reason], { permission: issue.permission.name }))
    await nextTick()
    const permissionElement = document.getElementById(`role-permission-${issue.permission.id}`)
    permissionElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
    permissionElement?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus()
    return null
  }
  return collectRoleSubmitData(roleFormModel.value, props.menuTree)
}

defineExpose({ collectSubmitData })
</script>

<template>
  <div v-loading="loading" class="assign-menu-permission">
    <div class="role-info-card mb-20px">
      <div class="role-info-toolbar mb-12px">
        <span class="role-info-title">{{ t('role.assignMenuPermission') }}</span>
        <BaseButton @click="handleImportPermissions" type="danger">
          <Icon icon="clipboard-paste" class="mr-4px" />
          {{ t('role.importMenuPermission') }}
        </BaseButton>
      </div>
      <ElForm inline label-width="80px">
        <ElFormItem :label="t('role.roleName')">
          <ElInput v-model="roleFormModel.name" class="!w-220px" :placeholder="t('role.roleNamePlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="t('role.roleCode')">
          <ElInput v-model="roleFormModel.code" class="!w-220px" :placeholder="t('role.roleCodePlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="t('userDemo.description')">
          <ElInput v-model="roleFormModel.description" class="!w-220px" type="textarea" :rows="1" />
        </ElFormItem>
        <ElFormItem :label="t('menu.status')">
          <ElSwitch
            v-model="roleFormModel.enabled"
            inline-prompt
            :active-text="t('userDemo.enable')"
            :inactive-text="t('userDemo.disable')"
          />
        </ElFormItem>
      </ElForm>
    </div>

    <div class="permission-layout">
      <div class="permission-panel">
        <div class="panel-header flex justify-between items-center">
          <span>{{ t('role.menuList') }}</span>
          <BaseButton v-if="menuTree.length" link type="danger" @click="toggleAllMenuPermissions">
            {{ isAllMenuPermissionChecked ? t('role.unselectAllMenuPermission') : t('role.selectAllMenuPermission') }}
          </BaseButton>
        </div>
        <ElInput v-model="menuSearch" class="mb-12px" :placeholder="t('role.menuSearchPlaceholder')" clearable>
          <template #prefix>
            <Icon icon="search" />
          </template>
        </ElInput>
        <!-- title需要使用i18n -->
        <div class="menu-tree-wrap">
          <ElTree
            ref="treeRef"
            :data="menuTree"
            node-key="id"
            show-checkbox
            highlight-current
            :expand-on-click-node="false"
            :default-expand-all="isExpandAll"
            :filter-node-method="filterRoleMenuNode"
            :props="{ label: 'title', children: 'children' }"
            @node-click="handleNodeClick"
            @check-change="handleCheckChange"
          >
            <template #default="{ data }">
              <span class="tree-node-content">
                <span class="tree-node-label">{{ t(data.title) }}</span>
                <span
                  class="tree-node-permission-count"
                  :class="{ 'is-zero': !(menuPermissionCountMap[data.id]?.selected > 0) }"
                >
                  {{ menuPermissionCountMap[data.id]?.text ?? '0' }}
                </span>
              </span>
            </template>
          </ElTree>
        </div>

        <div class="panel-footer">
          <span class="text-gray-500">{{ t('role.selectedMenuCount', { count: selectedMenuCount }) }}</span>
          <span class="link-text" @click="toggleExpandAll">
            {{ isExpandAll ? t('role.collapseAll') : t('role.expandAll') }}
          </span>
        </div>
      </div>

      <div class="permission-panel">
        <div class="panel-header flex justify-between items-center">
          <div class="flex items-center gap-2">
            <ElTag> {{ currentMenu?.title ? t(currentMenu.title) : t('role.permissionConfig') }}</ElTag>
            <span>
              {{
                currentMenu?.title
                  ? t('role.menuPermissionTitle', { name: t(currentMenu.title) })
                  : t('role.permissionConfig')
              }}
            </span>
          </div>
          <BaseButton
            v-if="currentMenuPermissions.length"
            link
            type="primary"
            @click="toggleCurrentMenuPermissions(!isCurrentMenuAllChecked)"
          >
            {{ t('role.selectAll') }}
          </BaseButton>
        </div>

        <div v-if="currentMenu" class="permission-tip mb-16px">
          {{ t('role.permissionConfigTip') }}
        </div>

        <div v-if="!currentMenu" class="empty-permission">
          {{ t('role.selectMenuTip') }}
        </div>

        <template v-else-if="permissionGroups.length">
          <div v-for="group in permissionGroups" :key="group.type" class="permission-group">
            <div class="group-title">
              <span class="group-title-bar"></span>
              {{ group.label }}
            </div>
            <div class="permission-grid">
              <div
                v-for="permission in group.permissions"
                :key="permission.id"
                :id="`role-permission-${permission.id}`"
                class="permission-item"
                :class="{ 'is-checked': permission.enabled && permission.checked, 'is-disabled': !permission.enabled }"
              >
                <div class="permission-item-header">
                  <ElTooltip :disabled="permission.enabled" :content="t('role.disabledPermissionTip')" placement="top">
                    <span>
                      <ElCheckbox
                        :model-value="permission.enabled && permission.checked"
                        :disabled="!permission.enabled"
                        @update:model-value="(val) => togglePermission(permission, !!val)"
                        @click.stop
                      >
                        {{ permission.name }}
                      </ElCheckbox>
                    </span>
                  </ElTooltip>
                  <ElTag
                    v-if="permission.enabled && permission.checked && permission.scopeEnabled && !permission.dataScope"
                    type="warning"
                    size="small"
                  >
                    {{ t('role.dataScopePending') }}
                  </ElTag>
                </div>
                <DataScopeEditor
                  v-if="permission.enabled && permission.checked && permission.scopeEnabled"
                  :model-value="permission"
                />
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-permission">
          {{ t('role.noPermissionTip') }}
        </div>

        <div class="panel-footer">
          <span class="text-gray-500">
            {{ t('role.selectedPermissionCount', { count: selectedPermissionCount }) }}
          </span>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <BaseButton @click="emit('cancel')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" :loading="saveLoading" @click="emit('save')">
        {{ t('exampleDemo.save') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped lang="less">
.assign-menu-permission {
  .role-info-card {
    padding: 20px 20px 4px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .role-info-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .role-info-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .permission-layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    min-height: 520px;
  }

  .permission-panel {
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .panel-header {
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .menu-tree-wrap {
    flex: 1;
    min-height: 360px;
    overflow: auto;

    :deep(.el-tree-node__content) {
      .tree-node-content {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        min-width: 0;
        padding-right: 8px;
      }

      .tree-node-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tree-node-permission-count {
        flex-shrink: 0;
        margin-left: 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--el-color-primary);

        &.is-zero {
          font-weight: 500;
          color: var(--el-text-color-placeholder);
        }
      }
    }
  }

  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .link-text {
    color: var(--el-color-primary);
    cursor: pointer;
  }

  .permission-tip {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .permission-group + .permission-group {
    margin-top: 20px;
  }

  .group-title {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .group-title-bar {
    width: 3px;
    height: 14px;
    margin-right: 8px;
    background: var(--el-color-primary);
    border-radius: 2px;
  }

  .permission-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .permission-item {
    min-height: 30px;
    padding: 8px;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    transition: all 0.2s;

    &.is-checked {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-5);
    }
  }

  .permission-item-header {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
  }

  .empty-permission {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    color: var(--el-text-color-secondary);
  }

  .page-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 20px;
    margin-top: 20px;
  }
}

@media (width <= 1400px) {
  .assign-menu-permission .permission-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 900px) {
  .assign-menu-permission {
    .permission-layout {
      grid-template-columns: 1fr;
    }

    .permission-grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
