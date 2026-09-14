<script setup lang="ts">
import { getRoleDetailApi, getRoleMenuAndPermissionApi } from '@/api/role'
import type { RoleAuthorizationMenu, RoleDetail } from '@/api/role/type'
import { ContentWrap } from '@/components/ContentWrap'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RoleDetailPanel from './components/RoleDetailPanel.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const roleDetail = ref<RoleDetail>()
const menuTree = ref<RoleAuthorizationMenu[]>([])

const roleId = computed(() => route.params.id as string)

const loadRoleDetail = async () => {
  if (!roleId.value) return

  const roleFromState = history.state?.role as Partial<RoleDetail> | undefined
  if (roleFromState?.name && roleFromState.id === roleId.value) {
    roleDetail.value = {
      ...(roleFromState as RoleDetail),
      menuCount: roleFromState.menuCount ?? 0,
      permissionCount: roleFromState.permissionCount ?? 0,
      userCount: roleFromState.userCount ?? 0,
    }
  }

  const res = await getRoleDetailApi(roleId.value)
  roleDetail.value = res.data
}

const loadMenuTree = async () => {
  if (!roleId.value) return
  const res = await getRoleMenuAndPermissionApi(roleId.value)
  menuTree.value = res.data.list || []
}

const initPage = async () => {
  loading.value = true
  try {
    await Promise.all([loadRoleDetail(), loadMenuTree()])
  } finally {
    loading.value = false
  }
}

const handleEdit = () => {
  if (!roleDetail.value) return
  router.push({
    name: 'RoleAssignMenuPermission',
    params: { id: roleId.value },
    state: {
      role: {
        id: roleDetail.value.id,
        name: roleDetail.value.name,
        code: roleDetail.value.code,
        enabled: roleDetail.value.enabled,
        description: roleDetail.value.description ?? '',
      },
    },
  })
}

onMounted(() => {
  initPage()
})
</script>

<template>
  <ContentWrap>
    <RoleDetailPanel :role-detail="roleDetail" :menu-tree="menuTree" :loading="loading" @edit="handleEdit" />
  </ContentWrap>
</template>
