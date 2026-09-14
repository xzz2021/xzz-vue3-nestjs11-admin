<script setup lang="ts">
import type { CreateDepartmentDto, DepartmentItem } from '@/api/department/types'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { type PropType, computed, markRaw, reactive, watch } from 'vue'
import { collectDescendantIds, snapshotDepartmentTree } from '../utils/departmentTree'

const { t } = useI18n()
const { required } = useValidator()

const props = defineProps({
  currentRow: {
    type: Object as PropType<DepartmentItem | null>,
    default: () => null,
  },
  departmentList: {
    type: Array as PropType<DepartmentItem[]>,
    default: () => [],
  },
})
// 当前节点不能选择自己和子孙节点作为父级
const disabledParentIds = computed(() => {
  const id = props.currentRow?.id
  if (!id) return new Set<string>()
  return collectDescendantIds(props.departmentList, id)
})

const formSchema = reactive<FormSchema[]>([
  {
    field: 'parentId',
    label: t('userDemo.superior'),
    component: 'TreeSelect',
    colProps: { span: 24 },
    componentProps: {
      nodeKey: 'id',
      props: {
        label: 'name',
        value: 'id',
        children: 'children',
        disabled: (data: DepartmentItem) => disabledParentIds.value.has(data.id),
      },
      defaultExpandAll: true,
      highlightCurrent: true,
      expandOnClickNode: false,
      checkStrictly: true,
      checkOnClickNode: true,
      clearable: true,
    },
    //  props是单向数据流  Form 会对 schema 做深层 watch,所以这里需要用 markRaw 来避免重复渲染
    optionApi: () => markRaw(snapshotDepartmentTree(props.departmentList)),
  },
  {
    field: 'name',
    label: t('userDemo.departmentName'),
    component: 'Input',
    colProps: { span: 24 },
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
      inactiveText: t('userDemo.disable'),
    },
  },
  {
    field: 'description',
    label: t('userDemo.remark'),
    component: 'Input',
    colProps: { span: 24 },
    componentProps: {
      type: 'textarea',
      rows: 4,
      maxlength: 200,
      showWordLimit: true,
    },
  },
])

const rules = reactive({
  name: [required()],
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

export type DepartmentFormData = CreateDepartmentDto & { id?: string }

const submit = async (): Promise<DepartmentFormData | undefined> => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch(() => false)
  if (!valid) return

  const formData = await getFormData(false)
  return {
    id: formData.id,
    parentId: formData.parentId || null,
    name: formData.name,
    enabled: formData.enabled ?? true,
    description: formData.description ?? '',
  }
}

watch(
  () => props.currentRow,
  (currentRow) => {
    if (!currentRow) {
      setValues({
        parentId: null,
        name: '',
        enabled: true,
        description: '',
      })
      return
    }

    setValues({
      id: currentRow.id,
      parentId: currentRow.parentId ?? null,
      name: currentRow.name,
      enabled: currentRow.enabled ?? true,
      description: currentRow.description ?? '',
    })
  },
  { immediate: true },
)

defineExpose({ submit })
</script>

<template>
  <Form :rules="rules" label-width="96px" @register="formRegister" :schema="formSchema" />
</template>
