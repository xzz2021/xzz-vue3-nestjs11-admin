<script setup lang="tsx">
import { delDictionaryTypeApi, saveDictionaryTypeApi } from '@/api/dictionary'
import type { DictionaryTypeItem } from '@/api/dictionary/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { ElInput, ElMessage, ElMessageBox, ElPopover, ElTag, ElTree } from 'element-plus'
import { computed, reactive, ref, unref, watch } from 'vue'
import { filterDictionaryTypesByName } from '../utils/dictionary'

const props = defineProps<{
  list: DictionaryTypeItem[]
  loading?: boolean
  currentTypeId?: string
}>()

const emit = defineEmits<{
  'update:currentTypeId': [id: string]
  refresh: [selectTypeId?: string]
}>()

const { t } = useI18n()
const { required } = useValidator()

const searchKeyword = ref('')
const treeEl = ref<InstanceType<typeof ElTree>>()

const dialogVisible = ref(false)
const dialogTitle = ref('')
const saveLoading = ref(false)

const filteredList = computed(() => filterDictionaryTypesByName(props.list, searchKeyword.value))

const isEditMode = ref(false)

const formSchema = reactive<FormSchema[]>([
  {
    field: 'name',
    label: t('tableDemo.name'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'code',
    label: t('tableDemo.code'),
    component: 'Input',
    colProps: { span: 24 },
    componentProps: {
      get disabled() {
        return isEditMode.value
      }
    }
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    component: 'Switch',
    value: true,
    colProps: { span: 24 },
    componentProps: {
      inlinePrompt: true,
      activeText: t('userDemo.enable'),
      inactiveText: t('userDemo.disable')
    }
  }
])

const rules = reactive({
  name: [required()],
  code: [required()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

watch(
  () => props.currentTypeId,
  (id) => {
    if (id) unref(treeEl)?.setCurrentKey(id)
  },
  { immediate: true }
)

const currentChange = (data: DictionaryTypeItem) => {
  if (!data?.id || data.id === props.currentTypeId) return
  emit('update:currentTypeId', data.id)
}

const openDialog = (row?: DictionaryTypeItem) => {
  isEditMode.value = !!row
  dialogTitle.value = row ? t('exampleDemo.edit') : t('exampleDemo.add')
  dialogVisible.value = true

  if (row) {
    setValues({
      id: row.id,
      name: row.name,
      code: row.code,
      enabled: row.enabled ?? true
    })
    return
  }

  setValues({
    name: '',
    code: '',
    enabled: true
  })
}

const handleDelete = async (row: DictionaryTypeItem) => {
  if (row.items?.length) {
    ElMessage.warning(t('dict.deleteTypeHasEntries'))
    return
  }

  try {
    await ElMessageBox.confirm(t('dict.confirmDeleteType', { name: row.name }), t('common.tip'), { type: 'warning' })
    await delDictionaryTypeApi([row.id])
    ElMessage.success(t('common.delSuccess'))
    emit('refresh')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
  }
}

const handleSave = async () => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch(() => false)
  if (!valid) return

  const formData = await getFormData(false)
  saveLoading.value = true
  try {
    const res = await saveDictionaryTypeApi({
      id: formData.id,
      name: formData.name,
      code: formData.code,
      enabled: formData.enabled ?? true
    })
    ElMessage.success(formData.id ? t('common.updateSuccess') : t('common.createSuccess'))
    dialogVisible.value = false
    emit('refresh', res.data.id)
  } finally {
    saveLoading.value = false
  }
}

const handleContextmenu = (id: string) => {
  unref(treeEl)?.setCurrentKey(id)
}
</script>

<template>
  <ContentWrap v-loading="loading" class="w-260px flex-shrink-0">
    <div class="mb-10px flex items-center justify-between">
      <span class="font-medium">{{ t('router.dictionaryType') }}</span>
      <div class="flex items-center gap-10px">
        <Icon icon="plus" :size="16" class="cursor-pointer" @click="openDialog()" />
        <Icon icon="rotate-cw" :size="16" class="cursor-pointer" @click="emit('refresh')" />
      </div>
    </div>

    <ElInput v-model="searchKeyword" class="mb-10px" :placeholder="t('dict.searchTypePlaceholder')" clearable />

    <ElTree
      ref="treeEl"
      :data="filteredList"
      default-expand-all
      :expand-on-click-node="false"
      node-key="id"
      :current-node-key="currentTypeId"
      highlight-current
      :props="{ label: 'name' }"
      @current-change="currentChange"
    >
      <template #default="{ data }">
        <ElPopover trigger="contextmenu" width="auto">
          <template #default>
            <BaseButton type="primary" plain @click="openDialog(data)">
              {{ t('exampleDemo.edit') }}
            </BaseButton>
            <BaseButton type="danger" plain @click="handleDelete(data)">
              {{ t('exampleDemo.del') }}
            </BaseButton>
          </template>
          <template #reference>
            <div class="flex w-full items-center justify-between gap-6px" @contextmenu="handleContextmenu(data.id)">
              <span :title="data.name" class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {{ data.name }}
              </span>
              <ElTag v-if="!data.enabled" size="small" type="info">禁用</ElTag>
            </div>
          </template>
        </ElPopover>
      </template>
    </ElTree>
  </ContentWrap>

  <Dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
    <Form :rules="rules" label-width="80px" @register="formRegister" :schema="formSchema" />

    <template #footer>
      <BaseButton @click="dialogVisible = false">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" :loading="saveLoading" @click="handleSave">
        {{ t('exampleDemo.save') }}
      </BaseButton>
    </template>
  </Dialog>
</template>
