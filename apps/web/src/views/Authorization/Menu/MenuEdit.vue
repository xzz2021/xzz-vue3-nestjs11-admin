<script setup lang="ts">
import { addMenuApi, editMenuApi, getMenuListApi } from '@/api/menu'
import type { MenuItem, MenuPermission } from '@/api/menu/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { useI18n } from '@/hooks/web/useI18n'
import { ElMessage } from 'element-plus'
import { cloneDeep } from 'lodash-es'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Write from './components/Write.vue'
import { findMenuById } from './utils/menuTree'
import { syncPermissions } from './utils/syncPermissions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const writeRef = ref<InstanceType<typeof Write>>()
const loading = ref(false)
const saveLoading = ref(false)
const ready = ref(false)
const currentRow = ref<MenuItem | null>(null)
const pageKey = ref(0)

const menuId = computed(() => route.params.id as string | undefined)

const loadMenuFromApi = async (id: string) => {
  const res = await getMenuListApi()
  const menu = findMenuById(res.data.list || [], id)
  if (!menu) {
    ElMessage.warning(t('menu.menuNotFound'))
    return null
  }
  return menu
}

const initPage = async () => {
  ready.value = false
  loading.value = true

  try {
    if (!menuId.value) {
      currentRow.value = null
      return
    }

    // 始终从接口拉取最新数据，避免 history.state 中 permissions 过期
    currentRow.value = await loadMenuFromApi(menuId.value)
    pageKey.value += 1
  } finally {
    loading.value = false
    ready.value = true
  }
}

const handleCancel = () => {
  router.back()
}

const onPermissionsChange = (permissions: MenuPermission[]) => {
  if (currentRow.value) {
    currentRow.value = { ...currentRow.value, permissions: cloneDeep(permissions) }
    history.replaceState({ ...history.state, menu: cloneDeep(currentRow.value) }, '')
  }
}

const handleSave = async () => {
  const result = await writeRef.value?.submit()
  if (!result) return

  saveLoading.value = true
  try {
    const { menu, permissions } = result
    const oldPermissions = currentRow.value?.permissions ?? []

    if (menu.id) {
      await editMenuApi(menu as any)
      await syncPermissions(menu.id, permissions, oldPermissions)
      ElMessage.success(t('common.updateSuccess'))
    } else {
      const res = await addMenuApi(menu as any)
      const newMenuId = res.data.id
      if (permissions.length) {
        await syncPermissions(newMenuId, permissions)
      }
      ElMessage.success(t('common.createSuccess'))
    }

    router.push({ name: 'Menu', state: { refresh: true } })
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
  <ContentWrap v-loading="loading">
    <div class="menu-edit-page">
      <div class="menu-edit-card">
        <Write
          v-if="ready"
          :key="`${menuId || 'new'}-${pageKey}`"
          ref="writeRef"
          :current-row="currentRow"
          @permissions-change="onPermissionsChange"
        />
      </div>

      <div class="menu-edit-footer">
        <BaseButton @click="handleCancel">{{ t('common.cancel') }}</BaseButton>
        <BaseButton type="primary" :loading="saveLoading" @click="handleSave">
          {{ t('exampleDemo.save') }}
        </BaseButton>
      </div>
    </div>
  </ContentWrap>
</template>

<style scoped lang="less">
.menu-edit-page {
  .menu-edit-header {
    margin-bottom: 16px;
  }

  .menu-edit-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .menu-edit-card {
    padding: 20px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .menu-edit-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 16px;
    margin-top: 16px;
  }
}
</style>
