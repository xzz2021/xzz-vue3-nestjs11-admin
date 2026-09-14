<script setup lang="ts">
import type { DictionaryEntryItem } from '@/api/dictionary/types'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { type PropType, reactive, watch } from 'vue'

const { t } = useI18n()
const { required } = useValidator()

const props = defineProps({
  currentRow: {
    type: Object as PropType<DictionaryEntryItem | null>,
    default: () => null
  },
  typeId: {
    type: String,
    default: ''
  }
})

const formSchema = reactive<FormSchema[]>([
  {
    field: 'label',
    label: t('tableDemo.title'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'value',
    label: t('tableDemo.code'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'sort',
    label: t('exampleDemo.sort'),
    component: 'InputNumber',
    value: 0,
    colProps: { span: 24 },
    componentProps: {
      min: 0,
      precision: 0
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
  label: [required()],
  value: [required()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

export type DictionaryEntryFormData = {
  id?: string
  typeId: string
  label: string
  value: string
  sort?: number
  enabled?: boolean
}

const submit = async (): Promise<DictionaryEntryFormData | undefined> => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch(() => false)
  if (!valid) return

  const formData = await getFormData(false)
  return {
    id: formData.id,
    typeId: formData.typeId || props.typeId,
    label: formData.label,
    value: formData.value,
    sort: formData.sort ?? 0,
    enabled: formData.enabled ?? true
  }
}

watch(
  () => [props.currentRow, props.typeId] as const,
  ([currentRow, typeId]) => {
    if (!currentRow) {
      setValues({
        typeId,
        label: '',
        value: '',
        sort: 0,
        enabled: true
      })
      return
    }

    setValues({
      id: currentRow.id,
      typeId: currentRow.typeId || typeId,
      label: currentRow.label,
      value: currentRow.value,
      sort: currentRow.sort ?? 0,
      enabled: currentRow.enabled ?? true
    })
  },
  { immediate: true }
)

defineExpose({ submit })
</script>

<template>
  <Form :rules="rules" label-width="80px" @register="formRegister" :schema="formSchema" />
</template>
