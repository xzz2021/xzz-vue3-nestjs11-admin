<script setup lang="ts">
import { searchMessageReceiversApi, sendMailApi, sendSystemApi } from '@/api/message'
import type { MessageType } from '@/api/message/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { Editor, RichTextPreview } from '@/components/Editor'
import { useI18n } from '@/hooks/web/useI18n'
import { ElInput, ElMessage, ElOption, ElSelect, ElTag } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

const { t } = useI18n()

type ReceiverOption = { id: string; username: string; nickname?: string | null; phone: string }
type SendKind = 'mail' | 'system'

interface PreviewMessage {
  title: string
  content: string
  type: MessageType
}

const sendForm = reactive({
  kind: 'system' as SendKind,
  receiverIds: [] as string[],
  title: '',
  content: ''
})
const receiverOptions = ref<ReceiverOption[]>([])
const receiverLoading = ref(false)
const submitting = ref(false)

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

const hasRichTextContent = (content: string) => {
  const document = new DOMParser().parseFromString(content, 'text/html')
  return Boolean(document.body.textContent?.trim() || document.body.querySelector('img,video,audio,table,hr'))
}

const fetchReceivers = async () => {
  receiverLoading.value = true
  try {
    const res = await searchMessageReceiversApi().catch(() => null)
    receiverOptions.value = res?.data?.list ?? []
  } finally {
    receiverLoading.value = false
  }
}

const resetForm = () => {
  sendForm.kind = 'system'
  sendForm.receiverIds = []
  sendForm.title = ''
  sendForm.content = ''
}

const composeMessageType = (): MessageType => (sendForm.kind === 'mail' ? 'MAIL' : 'SYSTEM')

const openComposePreview = () => {
  previewMessage.value = {
    title: sendForm.title.trim() || t('message.untitled'),
    content: sendForm.content,
    type: composeMessageType()
  }
  previewVisible.value = true
}

const submitSend = async () => {
  if (!sendForm.title.trim() || !hasRichTextContent(sendForm.content)) {
    ElMessage.warning(t('message.fillRequired'))
    return
  }
  if (sendForm.content.length > 5000) {
    ElMessage.warning(t('message.contentTooLong'))
    return
  }
  if (sendForm.kind === 'mail' && !sendForm.receiverIds.length) {
    ElMessage.warning(t('message.selectReceiver'))
    return
  }

  const title = sendForm.title.trim()
  const content = sendForm.content.trim()
  submitting.value = true
  try {
    let res = null as Awaited<ReturnType<typeof sendSystemApi>> | null
    if (sendForm.kind === 'mail') {
      res = await sendMailApi({ receiverIds: sendForm.receiverIds, title, content }).catch(() => null)
    } else {
      res = await sendSystemApi({ title, content }).catch(() => null)
    }
    if (res) {
      ElMessage.success(res.message || t('message.sendQueued'))
      resetForm()
    }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void fetchReceivers()
})
</script>

<template>
  <ContentWrap :title="t('router.notification')">
    <p class="mb-16px mt-0 text-13px text-[var(--el-text-color-secondary)]">
      {{ t('message.adminHint') }}
    </p>

    <div class="flex flex-col gap-12px max-w-760px">
      <ElSelect v-model="sendForm.kind" class="w-full">
        <ElOption :label="t('message.typeMail')" value="mail" />
        <ElOption :label="t('message.typeSystem')" value="system" />
      </ElSelect>
      <ElSelect
        v-if="sendForm.kind === 'mail'"
        v-model="sendForm.receiverIds"
        multiple
        filterable
        clearable
        collapse-tags
        collapse-tags-tooltip
        class="w-full"
        :placeholder="t('message.receiver')"
        :loading="receiverLoading"
      >
        <ElOption
          v-for="item in receiverOptions"
          :key="item.id"
          :label="`${item.username} ${item.nickname ? ` (${item.nickname})` : ''} · ${item.phone}`"
          :value="item.id"
        />
      </ElSelect>
      <ElInput v-model="sendForm.title" :placeholder="t('message.title')" maxlength="200" />
      <Editor
        v-model="sendForm.content"
        editor-id="message-admin-content-editor"
        height="280px"
        :editor-config="{ placeholder: t('message.contentPlaceholder') }"
      />
      <div class="text-right text-12px text-[var(--el-text-color-secondary)]">
        {{ sendForm.content.length }} / 5000
      </div>
      <div class="flex items-center justify-end gap-8px">
        <BaseButton @click="resetForm">{{ t('common.reset') }}</BaseButton>
        <BaseButton @click="openComposePreview">{{ t('message.preview') }}</BaseButton>
        <BaseButton type="primary" :loading="submitting" v-hasPermi="'notification:send'" @click="submitSend">
          {{ t('message.send') }}
        </BaseButton>
      </div>
    </div>

    <Dialog v-model="previewVisible" :title="t('message.preview')" width="720px" max-height="70vh">
      <template v-if="previewMessage">
        <div class="mb-16px border-b border-b-solid border-[var(--el-border-color)] pb-16px">
          <h2 class="m-0 mb-10px text-20px">{{ previewMessage.title }}</h2>
          <div class="flex flex-wrap items-center gap-12px text-13px text-[var(--el-text-color-secondary)]">
            <ElTag size="small" :type="typeTag(previewMessage.type)">
              {{ typeLabel(previewMessage.type) }}
            </ElTag>
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
