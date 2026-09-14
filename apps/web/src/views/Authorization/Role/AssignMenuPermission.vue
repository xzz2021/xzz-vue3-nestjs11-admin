<script setup lang="ts">
import { addRoleApi, editRoleApi, getRoleListApi, getRoleMenuAndPermissionApi } from '@/api/role'
import { ContentWrap } from '@/components/ContentWrap'
import { useI18n } from '@/hooks/web/useI18n'
import { useRoleStore } from '@/store/modules/role'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AssignMenuPermissionPanel from './components/AssignMenuPermissionPanel.vue'
import type { RoleFormModel, RoleMenuTreeNode } from './utils/roleMenuTree'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const roleStore = useRoleStore()

const panelRef = ref<InstanceType<typeof AssignMenuPermissionPanel>>()
const loading = ref(false)
const saveLoading = ref(false)
const menuTree = ref<RoleMenuTreeNode[]>([])
const pageKey = ref(0)

const roleForm = reactive<RoleFormModel>({
  name: '',
  code: '',
  enabled: true,
  description: '',
})

const roleId = computed(() => route.params.id as string | undefined)

const fillRoleForm = (role: Partial<RoleFormModel>) => {
  Object.assign(roleForm, {
    id: role.id || roleId.value,
    name: role.name || '',
    code: role.code || '',
    enabled: role.enabled ?? true,
    description: role.description || '',
  })
}

const loadRoleBasicInfo = async () => {
  const roleFromState = history.state?.role as Partial<RoleFormModel> | undefined
  if (roleFromState?.name) {
    fillRoleForm(roleFromState)
    return
  }

  if (!roleId.value) return

  const res = await getRoleListApi({ pageIndex: 1, pageSize: 100 })
  const role = res.data.list?.find((item) => item.id === roleId.value)
  if (role) {
    fillRoleForm(role)
  }
}

const initPage = async () => {
  loading.value = true
  try {
    if (roleId.value) {
      await loadRoleBasicInfo()
      const res = await getRoleMenuAndPermissionApi(roleId.value)
      menuTree.value = res.data.list || []
    } else {
      const res = await getRoleMenuAndPermissionApi('__new__')
      menuTree.value = res.data.list || []
    }
    pageKey.value += 1
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.back()
}

const handleSave = async () => {
  if (!roleForm.name?.trim()) {
    ElMessage.warning(t('role.nameRequired'))
    return
  }
  if (!roleForm.code?.trim()) {
    ElMessage.warning(t('role.codeRequired'))
    return
  }

  const submitData = await panelRef.value?.collectSubmitData()
  if (!submitData) return

  if (!submitData.menus.length) {
    ElMessage.warning(t('role.menuRequired'))
    return
  }

  saveLoading.value = true
  try {
    if (roleId.value) {
      await editRoleApi({ ...submitData, id: roleId.value })
      ElMessage.success(t('common.saveSuccess'))
    } else {
      await addRoleApi(submitData)
      ElMessage.success(t('common.createSuccess'))
    }
    // 待商定 是否需要更新角色信息
    await roleStore.requestNewList({ pageIndex: 1, pageSize: 100 })
    router.push({ name: 'Role', state: { refresh: true } })
  } catch (error) {
    console.error(error)
    ElMessage.error(t('common.saveFailed'))
  } finally {
    saveLoading.value = false
  }
}

onMounted(() => {
  initPage()
})
</script>

<template>
  <ContentWrap>
    <AssignMenuPermissionPanel
      :key="`${roleId || 'new'}-${pageKey}`"
      ref="panelRef"
      v-model:role-form="roleForm"
      :menu-tree="menuTree"
      :loading="loading"
      :save-loading="saveLoading"
      @cancel="handleCancel"
      @save="handleSave"
    />
  </ContentWrap>
</template>
