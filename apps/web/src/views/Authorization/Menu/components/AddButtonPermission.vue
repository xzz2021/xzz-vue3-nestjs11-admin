<script setup lang="ts">
import type { MenuPermission, PermissionType } from '@/api/menu/types'
import { BaseButton } from '@/components/Button'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { ElDrawer, ElInput, ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import {
  buildPermissionCode,
  getPermissionCodePrefix,
  getPermissionCodeSuffix,
  PERMISSION_CODE_SUFFIX_PATTERN
} from '../utils/permissionCode'

const modelValue = defineModel<boolean>({ default: false })

const props = defineProps<{
  menuPath?: string
  editData?: MenuPermission | null
  confirmLoading?: boolean
}>()

const { required } = useValidator()
const { t } = useI18n()

const PERMISSION_TYPE_OPTIONS = [
  { label: t('menu.permissionTypeButton'), value: 'BUTTON' },
  { label: t('menu.permissionTypeData'), value: 'DATA' },
  { label: t('menu.permissionTypeApi'), value: 'API' },
  { label: t('menu.permissionTypeOther'), value: 'OTHER' }
]

const codeSuffix = ref('')
const codePrefix = computed(() => getPermissionCodePrefix(props.menuPath))
const isEdit = computed(() => !!props.editData?.id)
const drawerTitle = computed(() => (isEdit.value ? t('menu.editPermissionTitle') : t('menu.addPermissionTitle')))

const formSchema = reactive<FormSchema[]>([
  {
    field: 'name',
    label: t('menu.permissionName'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'type',
    label: t('menu.permissionType'),
    component: 'Select',
    value: 'BUTTON',
    colProps: { span: 24 },
    componentProps: {
      options: PERMISSION_TYPE_OPTIONS
    }
  },
  {
    field: 'sort',
    label: t('menu.sortOrder'),
    component: 'InputNumber',
    value: 0,
    colProps: { span: 24 },
    componentProps: { min: 0 }
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
  },
  {
    field: 'scopeEnabled',
    label: t('menu.scopeEnabled'),
    component: 'Switch',
    value: false,
    colProps: { span: 24 },
    componentProps: {
      inlinePrompt: true,
      activeText: t('menu.scopeEnabledOn'),
      inactiveText: t('menu.scopeEnabledOff')
    }
  }
])

const { formRegister, formMethods } = useForm()
const { getFormData, getElFormExpose, setValues } = formMethods

const emit = defineEmits<{
  confirm: [data: MenuPermission]
}>()

const rules = reactive({
  name: [required()],
  type: [required()]
})

const resetForm = () => {
  codeSuffix.value = ''
  setValues({
    name: '',
    type: 'BUTTON' as PermissionType,
    sort: 0,
    enabled: true,
    scopeEnabled: false
  })
}

const fillForm = (data: MenuPermission) => {
  codeSuffix.value = getPermissionCodeSuffix(data.code, props.menuPath)
  setValues({
    name: data.name,
    type: data.type,
    sort: data.sort ?? 0,
    enabled: data.enabled ?? true,
    scopeEnabled: data.scopeEnabled ?? false
  })
}

watch(
  () => [modelValue.value, props.editData] as const,
  ([visible, editData]) => {
    if (!visible) return
    if (editData) {
      fillForm(editData)
    } else {
      resetForm()
    }
  }
)

const confirm = async () => {
  if (!props.menuPath?.trim()) {
    ElMessage.warning(t('menu.pathRequired'))
    return
  }
  if (!codeSuffix.value.trim()) {
    ElMessage.warning(t('menu.permissionCodeSuffixRequired'))
    return
  }
  if (!PERMISSION_CODE_SUFFIX_PATTERN.test(codeSuffix.value.trim())) {
    ElMessage.warning(t('menu.permissionCodeSuffixInvalid'))
    return
  }

  const elFormExpose = await getElFormExpose()
  if (!elFormExpose) return
  const valid = await elFormExpose?.validate().catch((err) => {
    console.log(err)
  })
  if (!valid) return

  try {
    const formData = await getFormData()
    const code = buildPermissionCode(props.menuPath, codeSuffix.value)
    emit('confirm', {
      ...(props.editData ?? {}),
      name: formData.name,
      code,
      type: formData.type,
      sort: formData.sort ?? 0,
      enabled: formData.enabled ?? true,
      scopeEnabled: formData.scopeEnabled ?? false
    })
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : t('menu.permissionCodeInvalid'))
  }
}
</script>

<template>
  <ElDrawer v-model="modelValue" :title="drawerTitle" size="420px" destroy-on-close>
    <template #default>
      <Form :rules="rules" @register="formRegister" :schema="formSchema" />
      <div class="permission-code-field">
        <div class="permission-code-field__label">
          {{ t('menu.permissionCode') }}
        </div>
        <ElInput v-model="codeSuffix" :placeholder="t('menu.permissionCodePlaceholder')">
          <template v-if="codePrefix" #prepend>{{ codePrefix }}:</template>
        </ElInput>
        <div class="permission-code-field__tip">
          {{ t('menu.permissionCodeTip') }}
        </div>
      </div>
    </template>
    <template #footer>
      <BaseButton @click="modelValue = false">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" :loading="confirmLoading" @click="confirm">{{ t('common.confirm') }}</BaseButton>
    </template>
  </ElDrawer>
</template>

<style scoped>
.permission-code-field {
  padding: 0 12px;
}

.permission-code-field__label {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.permission-code-field__tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
