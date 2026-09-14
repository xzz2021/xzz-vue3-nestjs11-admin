<script setup lang="ts">
import type { DepartmentItem } from '@/api/department/types'
import type { DataScope, RoleAuthorizationPermission } from '@/api/role/type'
import { BaseButton } from '@/components/Button'
import { useI18n } from '@/hooks/web/useI18n'
import { useDepartmentStore } from '@/store/modules/department'
import { ElOption, ElSelect, ElTag, ElTreeSelect } from 'element-plus'
import { computed, onMounted, watch } from 'vue'
import { DATA_SCOPE_I18N } from '../utils/roleMenuTree'

interface DepartmentTreeOption {
  value: string
  label: string
  disabled: boolean
  children?: DepartmentTreeOption[]
}

const permission = defineModel<RoleAuthorizationPermission>({ required: true })
const departmentStore = useDepartmentStore()
const { t } = useI18n()

const scopeValues: DataScope[] = ['ALL', 'SELF', 'DEPT', 'DEPT_TREE', 'CUSTOM_DEFINE']
const scopeDescriptionKeys: Record<DataScope, string> = {
  ALL: 'role.dataScopeAllDescription',
  SELF: 'role.dataScopeSelfDescription',
  DEPT: 'role.dataScopeDepartmentDescription',
  DEPT_TREE: 'role.dataScopeDepartmentTreeDescription',
  CUSTOM_DEFINE: 'role.dataScopeCustomDescription'
}

const flattenDepartments = (nodes: DepartmentItem[], result: DepartmentItem[] = []): DepartmentItem[] => {
  for (const node of nodes) {
    result.push(node)
    if (node.children?.length) flattenDepartments(node.children, result)
  }
  return result
}

const departmentMap = computed(
  () => new Map(flattenDepartments(departmentStore.list).map((department) => [department.id, department]))
)

const invalidDepartmentIds = computed(() => {
  const invalid = new Set(permission.value.disabledDepartmentIds)
  for (const id of permission.value.departmentIds) {
    const department = departmentMap.value.get(id)
    if (department?.enabled === false) invalid.add(id)
    if (departmentStore.loaded && !departmentStore.loadError && !department) invalid.add(id)
  }
  return [...invalid].filter((id) => permission.value.departmentIds.includes(id))
})

const toOptions = (nodes: DepartmentItem[]): DepartmentTreeOption[] =>
  nodes.map((node) => ({
    value: node.id,
    label: node.name,
    disabled: node.enabled === false,
    ...(node.children?.length ? { children: toOptions(node.children) } : {})
  }))

const departmentOptions = computed(() => {
  const options = toOptions(departmentStore.list)
  const missing = permission.value.departmentIds
    .filter((id) => !departmentMap.value.has(id))
    .map((id) => ({
      value: id,
      label: t('role.missingDepartmentOption', { id }),
      disabled: true
    }))
  return [...options, ...missing]
})

const customDepartmentIds = computed<string[]>({
  get: () => (permission.value.dataScope === 'CUSTOM_DEFINE' ? permission.value.departmentIds : []),
  set: (ids) => {
    permission.value.departmentIds = permission.value.dataScope === 'CUSTOM_DEFINE' ? [...new Set(ids)] : []
  }
})

const selectedDataScope = computed<DataScope | ''>({
  get: () => permission.value.dataScope || '',
  set: (scope) => {
    permission.value.dataScope = scope || null
  }
})

const selectedScopeDescription = computed(() =>
  permission.value.dataScope ? t(scopeDescriptionKeys[permission.value.dataScope]) : t('role.dataScopeRequiredTip')
)

const invalidDepartmentLabel = (id: string) => departmentMap.value.get(id)?.name || id

const removeInvalidDepartments = () => {
  const invalid = new Set(invalidDepartmentIds.value)
  permission.value.departmentIds = permission.value.departmentIds.filter((id) => !invalid.has(id))
  permission.value.disabledDepartmentIds = permission.value.disabledDepartmentIds.filter((id) => !invalid.has(id))
}

watch(
  () => permission.value.dataScope,
  (scope) => {
    if (scope !== 'CUSTOM_DEFINE') {
      permission.value.departmentIds = []
      permission.value.disabledDepartmentIds = []
    }
  }
)

onMounted(() => {
  void departmentStore.ensureList()
})
</script>

<template>
  <div class="data-scope-editor">
    <div class="data-scope-row">
      <span class="data-scope-label">{{ t('role.dataScope') }}</span>
      <ElSelect
        v-model="selectedDataScope"
        class="data-scope-select"
        clearable
        :placeholder="t('role.dataScopePlaceholder')"
      >
        <ElOption v-for="scope in scopeValues" :key="scope" :label="t(DATA_SCOPE_I18N[scope])" :value="scope" />
      </ElSelect>
    </div>
    <div class="data-scope-description">{{ selectedScopeDescription }}</div>

    <template v-if="permission.dataScope === 'CUSTOM_DEFINE'">
      <ElTreeSelect
        v-model="customDepartmentIds"
        class="department-select"
        multiple
        check-strictly
        collapse-tags
        collapse-tags-tooltip
        filterable
        clearable
        node-key="value"
        :data="departmentOptions"
        :props="{ value: 'value', label: 'label', children: 'children', disabled: 'disabled' }"
        :loading="departmentStore.loading"
        :placeholder="t('role.customDepartmentPlaceholder')"
      />
      <div class="department-status">
        <span>{{ t('role.selectedDepartmentCount', { count: permission.departmentIds.length }) }}</span>
        <span v-if="departmentStore.loading">{{ t('role.departmentLoading') }}</span>
        <span v-else-if="departmentStore.loadError" class="status-error">
          {{ t('role.departmentLoadFailed') }}
        </span>
      </div>
      <div v-if="invalidDepartmentIds.length" class="invalid-departments">
        <div class="invalid-header">
          <span>{{ t('role.invalidDepartments') }}</span>
          <BaseButton link type="danger" @click.stop="removeInvalidDepartments">
            {{ t('role.removeInvalidDepartments') }}
          </BaseButton>
        </div>
        <div class="invalid-tags">
          <ElTag v-for="id in invalidDepartmentIds" :key="id" type="danger" effect="plain">
            {{ invalidDepartmentLabel(id) }}
          </ElTag>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="less">
.data-scope-editor {
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px dashed var(--el-border-color);
}

.data-scope-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.data-scope-label {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.data-scope-select,
.department-select {
  width: 100%;
}

.data-scope-description,
.department-status {
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.department-select {
  margin-top: 8px;
}

.department-status {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.status-error,
.invalid-header {
  color: var(--el-color-danger);
}

.invalid-departments {
  margin-top: 8px;
}

.invalid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.invalid-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
</style>
