<script setup lang="tsx">
import { getOnlineListApi, kickOnlineSessionApi, kickOnlineUserApi } from '@/api/online'
import type { OnlineUserItem } from '@/api/online/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Table, type TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useOnlinePresenceStore } from '@/store/modules/onlinePresence'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElInput, ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const { t } = useI18n()
const presenceStore = useOnlinePresenceStore()

const loading = ref(false)
const keyword = ref('')
const list = ref<OnlineUserItem[]>([])
const onlineCount = ref(0)
const awayCount = ref(0)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const statusTag = (status: string) => {
  if (status === 'online') return <ElTag type="success">{t('onlineUser.statusOnline')}</ElTag>
  return <ElTag type="warning">{t('onlineUser.statusAway')}</ElTag>
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getOnlineListApi({ keyword: keyword.value || undefined })
    list.value = res.data?.list ?? []
    onlineCount.value = res.data?.onlineCount ?? 0
    awayCount.value = res.data?.awayCount ?? 0
  } catch {
    // axios 已提示
  } finally {
    loading.value = false
  }
}

const kickSession = async (row: OnlineUserItem) => {
  if (!row.kickable) {
    ElMessage.warning(row.isSelf ? t('onlineUser.cannotKickSelf') : t('onlineUser.cannotKickAdmin'))
    return
  }
  try {
    await ElMessageBox.confirm(
      t('onlineUser.kickSessionConfirm', { name: row.username }),

      t('common.reminder'),
      {
        type: 'warning',
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel')
      }
    )
  } catch {
    return
  }
  const res = await kickOnlineSessionApi({ jti: row.jti, userId: row.userId }).catch(() => null)
  if (res) {
    ElMessage.success(res.message || t('onlineUser.kickSuccess'))
    fetchList()
  }
}

const kickUser = async (row: OnlineUserItem) => {
  if (!row.kickable) {
    ElMessage.warning(row.isSelf ? t('onlineUser.cannotKickSelf') : t('onlineUser.cannotKickAdmin'))
    return
  }
  try {
    await ElMessageBox.confirm(t('onlineUser.kickUserConfirm', { name: row.username }), t('common.reminder'), {
      type: 'warning',
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return
  }
  const res = await kickOnlineUserApi(row.userId).catch(() => null)
  if (res) {
    ElMessage.success(res.message || t('onlineUser.kickSuccess'))
    fetchList()
  }
}

const tableColumns = reactive<TableColumn[]>([
  { field: 'index', label: t('tableDemo.index'), type: 'index', width: 60 },
  { field: 'username', label: t('onlineUser.username'), minWidth: 110 },
  {
    field: 'phone',
    label: t('onlineUser.phone'),
    width: 120,
    formatter: (row: OnlineUserItem) => row.phone || '-'
  },
  {
    field: 'location',
    label: t('onlineUser.location'),
    minWidth: 160,
    formatter: (row: OnlineUserItem) => row.location || '-'
  },
  {
    field: 'browser',
    label: t('onlineUser.browserOs'),
    minWidth: 180,
    formatter: (row: OnlineUserItem) => `${row.browser} / ${row.os}`
  },
  { field: 'device', label: t('onlineUser.device'), width: 90 },
  {
    field: 'loginAt',
    label: t('onlineUser.loginAt'),
    width: 170,
    formatter: (row: OnlineUserItem) => formatToDateTime(row.loginAt)
  },
  {
    field: 'lastPingAt',
    label: t('onlineUser.lastPingAt'),
    width: 170,
    formatter: (row: OnlineUserItem) => formatToDateTime(row.lastPingAt)
  },
  {
    field: 'status',
    label: t('onlineUser.status'),
    width: 90,
    align: 'center',
    slots: {
      default: (data: { row: OnlineUserItem }) => statusTag(data.row.status)
    }
  },
  {
    field: 'action',
    label: t('onlineUser.action'),
    width: 200,
    fixed: 'right',
    slots: {
      default: (data: { row: OnlineUserItem }) => {
        const row = data.row
        if (!row.kickable) {
          const tip = row.isSelf
            ? t('onlineUser.cannotKickSelf')
            : row.isSuperAdmin
              ? t('onlineUser.cannotKickAdmin')
              : t('onlineUser.cannotKick')
          return <span class="text-12px text-[var(--el-text-color-secondary)]">{tip}</span>
        }
        return (
          <>
            <BaseButton type="warning" link onClick={() => kickSession(row)}>
              {t('onlineUser.kickSession')}
            </BaseButton>
            <BaseButton type="danger" link onClick={() => kickUser(row)}>
              {t('onlineUser.kickUser')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

onMounted(() => {
  fetchList()
  refreshTimer = setInterval(fetchList, 10_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <ContentWrap :title="t('router.onlineUser')">
    <div class="mb-12px flex flex-wrap items-center justify-between gap-8px">
      <div class="flex items-center gap-12px text-13px">
        <ElTag type="success" effect="plain">{{ t('onlineUser.onlineCount') }} {{ onlineCount }}</ElTag>
        <ElTag type="warning" effect="plain">{{ t('onlineUser.awayCount') }} {{ awayCount }}</ElTag>
        <ElTag :type="presenceStore.connected ? 'success' : 'info'" effect="plain">
          {{ presenceStore.connected ? t('onlineUser.selfConnected') : t('onlineUser.selfDisconnected') }}
        </ElTag>
      </div>
      <div class="flex items-center gap-8px">
        <ElInput
          v-model="keyword"
          clearable
          class="w-220px"
          :placeholder="t('onlineUser.searchPlaceholder')"
          @keyup.enter="fetchList"
        />
        <BaseButton type="primary" @click="fetchList">{{ t('common.query') }}</BaseButton>
        <BaseButton @click="fetchList">{{ t('common.refresh') }}</BaseButton>
      </div>
    </div>

    <Table :columns="tableColumns" :data="list" :loading="loading" row-key="jti" />
  </ContentWrap>
</template>
