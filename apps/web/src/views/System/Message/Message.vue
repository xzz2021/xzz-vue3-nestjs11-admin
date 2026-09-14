<script setup lang="tsx">
import { deleteMessageApi, getMessageListApi, markAllMessageReadApi, markMessageReadApi } from '@/api/message'
import type { MessageItem, MessageType } from '@/api/message/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { RichTextPreview } from '@/components/Editor'
import { Table, type TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useMessageStore } from '@/store/modules/message'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElMessage, ElMessageBox, ElOption, ElSelect, ElTag } from 'element-plus'
import { onMounted, reactive, ref, unref } from 'vue'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const list = ref<MessageItem[]>([])
const total = ref(0)
const pageIndex = ref(1)
const pageSize = ref(20)
const typeFilter = ref<MessageType | ''>('')
const unreadOnly = ref(false)
const selectedIds = ref<string[]>([])

interface PreviewMessage {
  title: string
  content: string
  type: MessageType
  sender?: string
  createdAt?: string
}

const previewVisible = ref(false)
const previewMessage = ref<PreviewMessage>()

const typeLabel = (type: MessageType) => {
  if (type === 'MAIL') return t('message.typeMail')
  if (type === 'SYSTEM') return t('message.typeSystem')
  return t('message.typeAlert')
}

const typeTag = (type: MessageType) => {
  if (type === 'ALERT') return 'danger'
  if (type === 'SYSTEM') return 'warning'
  return 'info'
}

const toPlainText = (content: string) => {
  const document = new DOMParser().parseFromString(content, 'text/html')
  return document.body.textContent?.replace(/\s+/g, ' ').trim() || ''
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getMessageListApi({
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
      type: typeFilter.value || undefined,
      unreadOnly: unreadOnly.value || undefined
    })
    list.value = res.data?.list ?? []
    total.value = res.data?.total ?? 0
    if (typeof res.data?.unread === 'number') {
      messageStore.setUnread(res.data.unread)
    }
  } finally {
    loading.value = false
  }
}

const onSelectionChange = (rows: MessageItem[]) => {
  selectedIds.value = rows.map((r) => r.id)
}

const markRead = async (ids: string[], options?: { silent?: boolean }) => {
  if (!ids.length) {
    if (!options?.silent) {
      ElMessage.warning(t('message.selectFirst'))
    }
    return
  }
  const res = await markMessageReadApi(ids).catch(() => null)
  if (res) {
    if (!options?.silent) {
      ElMessage.success(res.message || t('message.markReadSuccess'))
    }
    messageStore.setUnread(res.data?.unread ?? messageStore.unread)
    fetchList()
  }
}

const markAll = async () => {
  const res = await markAllMessageReadApi().catch(() => null)
  if (res) {
    ElMessage.success(res.message || t('message.markAllSuccess'))
    messageStore.setUnread(0)
    fetchList()
  }
}

const removeSelected = async () => {
  if (!selectedIds.value.length) {
    ElMessage.warning(t('message.selectFirst'))
    return
  }
  try {
    await ElMessageBox.confirm(t('message.deleteConfirm'), t('common.reminder'), { type: 'warning' })
  } catch {
    return
  }
  const res = await deleteMessageApi(unref(selectedIds)).catch(() => null)
  if (res) {
    ElMessage.success(res.message || t('message.deleteSuccess'))
    messageStore.setUnread(res.data?.unread ?? messageStore.unread)
    fetchList()
  }
}

const openMessagePreview = (row: MessageItem) => {
  previewMessage.value = {
    title: row.title,
    content: row.content,
    type: row.type,
    sender: row.sender?.username || '-',
    createdAt: row.createdAt
  }
  previewVisible.value = true
  if (!row.readAt) {
    void markRead([row.id], { silent: true })
  }
}

const tableColumns = reactive<TableColumn[]>([
  { field: 'selection', type: 'selection', width: 48 },
  { field: 'index', label: t('tableDemo.index'), type: 'index', width: 60 },
  {
    field: 'type',
    label: t('message.type'),
    width: 100,
    slots: {
      default: (data: { row: MessageItem }) => (
        <ElTag size="small" type={typeTag(data.row.type)}>
          {typeLabel(data.row.type)}
        </ElTag>
      )
    }
  },
  {
    field: 'title',
    label: t('message.title'),
    minWidth: 160,
    slots: {
      default: (data: { row: MessageItem }) => <span class={!data.row.readAt ? 'font-600' : ''}>{data.row.title}</span>
    }
  },
  {
    field: 'content',
    label: t('message.content'),
    minWidth: 220,
    formatter: (row: MessageItem) => toPlainText(row.content) || '-'
  },
  {
    field: 'sender',
    label: t('message.sender'),
    width: 110,
    formatter: (row: MessageItem) => row.sender?.username || '-'
  },
  {
    field: 'createdAt',
    label: t('message.time'),
    width: 170,
    formatter: (row: MessageItem) => formatToDateTime(row.createdAt)
  },
  {
    field: 'readAt',
    label: t('message.status'),
    width: 90,
    slots: {
      default: (data: { row: MessageItem }) =>
        data.row.readAt ? (
          <ElTag size="small" type="info">
            {t('message.read')}
          </ElTag>
        ) : (
          <ElTag size="small" type="danger">
            {t('message.unread')}
          </ElTag>
        )
    }
  },
  {
    field: 'action',
    label: t('message.action'),
    width: 100,
    fixed: 'right',
    slots: {
      default: (data: { row: MessageItem }) => (
        <BaseButton type="primary" link onClick={() => openMessagePreview(data.row)}>
          {t('message.view')}
        </BaseButton>
      )
    }
  }
])

onMounted(fetchList)
</script>

<template>
  <ContentWrap :title="t('router.message')">
    <div class="mb-12px flex flex-wrap items-center justify-between gap-8px">
      <div class="flex items-center gap-8px flex-wrap">
        <ElSelect v-model="typeFilter" clearable class="w-140px" :placeholder="t('message.type')" @change="fetchList">
          <ElOption :label="t('message.typeMail')" value="MAIL" />
          <ElOption :label="t('message.typeSystem')" value="SYSTEM" />
          <ElOption :label="t('message.typeAlert')" value="ALERT" />
        </ElSelect>
        <BaseButton
          :type="unreadOnly ? 'primary' : 'default'"
          @click="
            () => {
              unreadOnly = !unreadOnly
              fetchList()
            }
          "
        >
          {{ t('message.unreadOnly') }}
        </BaseButton>
        <ElTag type="danger" effect="plain">{{ t('message.unread') }} {{ messageStore.unread }}</ElTag>
      </div>
      <div class="flex items-center gap-8px flex-wrap">
        <BaseButton @click="markRead(selectedIds)">{{ t('message.markRead') }}</BaseButton>
        <BaseButton @click="markAll">{{ t('message.markAll') }}</BaseButton>
        <BaseButton type="danger" @click="removeSelected">{{ t('common.delete') }}</BaseButton>
        <BaseButton @click="fetchList">{{ t('common.refresh') }}</BaseButton>
      </div>
    </div>

    <Table
      :columns="tableColumns"
      :data="list"
      :loading="loading"
      :pagination="{ total }"
      v-model:currentPage="pageIndex"
      v-model:pageSize="pageSize"
      row-key="id"
      @selection-change="onSelectionChange"
      @update:current-page="fetchList"
      @update:page-size="fetchList"
    />

    <Dialog v-model="previewVisible" :title="t('message.preview')" width="720px" max-height="70vh">
      <template v-if="previewMessage">
        <div class="mb-16px border-b border-b-solid border-[var(--el-border-color)] pb-16px">
          <h2 class="m-0 mb-10px text-20px">{{ previewMessage.title }}</h2>
          <div class="flex flex-wrap items-center gap-12px text-13px text-[var(--el-text-color-secondary)]">
            <ElTag size="small" :type="typeTag(previewMessage.type)">
              {{ typeLabel(previewMessage.type) }}
            </ElTag>
            <span v-if="previewMessage.sender">{{ t('message.sender') }}：{{ previewMessage.sender }}</span>
            <span v-if="previewMessage.createdAt">
              {{ formatToDateTime(previewMessage.createdAt) }}
            </span>
          </div>
        </div>
        <RichTextPreview :content="previewMessage.content" :empty-text="t('message.emptyContent')" />
      </template>
      <template #footer>
        <BaseButton type="primary" @click="previewVisible = false">{{ t('common.close') }}</BaseButton>
      </template>
    </Dialog>
  </ContentWrap>
</template>
