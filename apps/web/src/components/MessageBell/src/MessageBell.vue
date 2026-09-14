<script setup lang="ts">
import { markAllMessageReadApi } from '@/api/message'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { useMessageStore } from '@/store/modules/message'
import { ElBadge, ElDropdown, ElDropdownItem, ElDropdownMenu, ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const goInbox = () => {
  router.push('/personal/message')
}

const markAll = async () => {
  const res = await markAllMessageReadApi().catch(() => null)
  if (res) {
    messageStore.setUnread(0)
    ElMessage.success(res.message || t('message.markAllSuccess'))
  }
}

const onCommand = (cmd: string) => {
  if (cmd === 'readAll') {
    markAll()
    return
  }
  goInbox()
}
</script>

<template>
  <ElDropdown trigger="click" @command="onCommand" class="custom-hover">
    <div class="flex items-center h-full cursor-pointer">
      <ElBadge :value="messageStore.unread" :hidden="!messageStore.unread" :max="99">
        <Icon icon="bell" :size="18" color="var(--top-header-text-color)" />
      </ElBadge>
    </div>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem command="inbox">
          {{ t('message.inbox') }}
          <span v-if="messageStore.unread" class="ml-8px text-[var(--el-color-danger)]">
            ({{ messageStore.unread }})
          </span>
        </ElDropdownItem>
        <ElDropdownItem v-if="messageStore.unread" command="readAll" divided>
          {{ t('message.markAll') }}
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>
