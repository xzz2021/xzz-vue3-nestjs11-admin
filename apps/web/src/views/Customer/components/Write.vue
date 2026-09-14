<script setup lang="ts">
import {
  CUSTOMER_STATUSES,
  type CreateCustomerPayload,
  type CustomerItem,
  type CustomerStatus,
  type UpdateCustomerPayload
} from '@/api/customer/type'
import { getUserLookupApi } from '@/api/user'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { useDepartmentStore } from '@/store/modules/department'
import type { FormItemRule } from 'element-plus'
import { ElMessage } from 'element-plus'
import { type PropType, reactive, unref, watch } from 'vue'
import { CUSTOMER_AMOUNT_PATTERN, normalizeOptionalText, sameOptionalText } from '../utils/customer'

const OWNER_PAGE_SIZE = 100

interface CustomerFormValues {
  id?: string
  version?: number
  name?: string
  phone?: string | null
  remark?: string | null
  status?: CustomerStatus
  dealAmount?: string
  internalCost?: string
  confidential?: boolean
  ownerId?: string
  departmentId?: string
}

const props = defineProps({
  currentRow: {
    type: Object as PropType<CustomerItem | undefined>,
    default: () => undefined
  },
  defaultDepartmentId: {
    type: String,
    default: ''
  },
  canAssign: {
    type: Boolean,
    default: false
  },
  canUpdateSensitive: {
    type: Boolean,
    default: false
  }
})

const { t } = useI18n()
const { required } = useValidator()
const departmentStore = useDepartmentStore()

const statusOptions = CUSTOMER_STATUSES.map((status) => ({
  label: t(`customer.status.${status}`),
  value: status
}))

const amountRule = (): FormItemRule => ({
  validator: (_, val, callback) => {
    if (val === undefined || val === null || val === '') return callback()
    if (!CUSTOMER_AMOUNT_PATTERN.test(String(val).trim())) {
      callback(new Error(t('customer.invalidAmount')))
      return
    }
    callback()
  }
})

const ownerSelectProps = reactive({
  filterable: true,
  clearable: true,
  options: [] as Array<{ label: string; value: string }>
})

const formSchema = reactive<FormSchema[]>([
  {
    field: 'name',
    label: t('customer.name'),
    component: 'Input',
    colProps: { span: 24 },
    componentProps: { maxlength: 100 }
  },
  {
    field: 'phone',
    label: t('customer.phone'),
    component: 'Input',
    colProps: { span: 24 },
    componentProps: { maxlength: 30 }
  },
  {
    field: 'status',
    label: t('customer.statusLabel'),
    component: 'Select',
    colProps: { span: 24 },
    componentProps: { options: statusOptions }
  },
  {
    field: 'dealAmount',
    label: t('customer.dealAmount'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'internalCost',
    label: t('customer.internalCost'),
    component: 'Input',
    colProps: { span: 24 },
    remove: !props.canUpdateSensitive
  },
  {
    field: 'confidential',
    label: t('customer.confidential'),
    component: 'Switch',
    colProps: { span: 24 },
    remove: !props.canUpdateSensitive,
    componentProps: {
      inlinePrompt: true,
      activeText: t('customer.yes'),
      inactiveText: t('customer.no')
    }
  },
  {
    field: 'departmentId',
    label: t('customer.department'),
    component: 'TreeSelect',
    colProps: { span: 24 },
    remove: !props.canAssign,
    componentProps: {
      nodeKey: 'id',
      props: {
        label: 'name',
        value: 'id',
        children: 'children'
      },
      highlightCurrent: true,
      expandOnClickNode: false,
      checkStrictly: true,
      checkOnClickNode: true,
      defaultExpandAll: true,
      clearable: true,
      onChange: (value: string | undefined) => {
        void loadOwners(value, true)
      }
    },
    optionApi: () => unref(departmentStore.list)
  },
  {
    field: 'ownerId',
    label: t('customer.owner'),
    component: 'Select',
    colProps: { span: 24 },
    remove: !props.canAssign,
    componentProps: ownerSelectProps
  },
  {
    field: 'remark',
    label: t('customer.remark'),
    component: 'Input',
    colProps: { span: 24 },
    componentProps: { type: 'textarea', rows: 3, maxlength: 2000 }
  }
])

const rules = reactive<Record<string, FormItemRule[]>>({
  name: [required()],
  dealAmount: [amountRule()],
  internalCost: [amountRule()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

const setFieldRemove = (field: string, remove: boolean) => {
  const item = formSchema.find((schema) => schema.field === field)
  if (item) item.remove = remove
}

const loadOwners = async (departmentId: string | undefined, resetOwner: boolean) => {
  if (!props.canAssign || !departmentId) {
    ownerSelectProps.options = []
    if (resetOwner) await setValues({ ownerId: undefined })
    return
  }

  try {
    const res = await getUserLookupApi({
      id: departmentId,
      pageIndex: 1,
      pageSize: OWNER_PAGE_SIZE,
      enabled: true
    })
    ownerSelectProps.options = (res.data.list || []).map((user) => ({
      label: user.username,
      value: user.id
    }))
    if (resetOwner) {
      await setValues({ ownerId: undefined })
    }
  } catch {
    ownerSelectProps.options = []
  }
}

const toCreatePayload = (formData: CustomerFormValues): CreateCustomerPayload => {
  const payload: CreateCustomerPayload = {
    name: String(formData.name || '').trim()
  }
  const phone = normalizeOptionalText(formData.phone)
  const remark = normalizeOptionalText(formData.remark)
  if (phone) payload.phone = phone
  if (remark) payload.remark = remark
  if (formData.status) payload.status = formData.status
  if (formData.dealAmount) payload.dealAmount = String(formData.dealAmount).trim()
  if (props.canUpdateSensitive) {
    if (formData.internalCost) payload.internalCost = String(formData.internalCost).trim()
    if (formData.confidential !== undefined) payload.confidential = Boolean(formData.confidential)
  }
  if (props.canAssign) {
    if (formData.ownerId) payload.ownerId = formData.ownerId
    if (formData.departmentId) payload.departmentId = formData.departmentId
  }
  return payload
}

const toUpdatePayload = (original: CustomerItem, formData: CustomerFormValues): UpdateCustomerPayload | undefined => {
  const payload: UpdateCustomerPayload = {
    id: original.id,
    version: original.version
  }
  let changed = false

  const name = String(formData.name || '').trim()
  if (name && name !== original.name) {
    payload.name = name
    changed = true
  }

  const phone = normalizeOptionalText(formData.phone)
  if (!sameOptionalText(original.phone, phone)) {
    payload.phone = phone
    changed = true
  }

  const remark = normalizeOptionalText(formData.remark)
  if (!sameOptionalText(original.remark, remark)) {
    payload.remark = remark
    changed = true
  }

  if (formData.status && formData.status !== original.status) {
    payload.status = formData.status
    changed = true
  }

  const dealAmount = formData.dealAmount ? String(formData.dealAmount).trim() : undefined
  if (dealAmount && dealAmount !== original.dealAmount) {
    payload.dealAmount = dealAmount
    changed = true
  }

  if (props.canUpdateSensitive) {
    const internalCost = formData.internalCost ? String(formData.internalCost).trim() : undefined
    if (internalCost !== undefined && internalCost !== original.internalCost) {
      payload.internalCost = internalCost
      changed = true
    }
    if (formData.confidential !== undefined && formData.confidential !== original.confidential) {
      payload.confidential = Boolean(formData.confidential)
      changed = true
    }
  }

  if (props.canAssign) {
    if (formData.ownerId && formData.ownerId !== original.ownerId) {
      payload.ownerId = formData.ownerId
      changed = true
    }
    if (formData.departmentId && formData.departmentId !== original.departmentId) {
      payload.departmentId = formData.departmentId
      changed = true
    }
  }

  return changed ? payload : undefined
}

const submit = async (): Promise<CreateCustomerPayload | UpdateCustomerPayload | undefined> => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch(() => false)
  if (!valid) return

  const formData = await getFormData<CustomerFormValues>(false)
  if (props.currentRow) {
    const payload = toUpdatePayload(props.currentRow, formData)
    if (!payload) {
      ElMessage.warning(t('customer.noChanges'))
      return
    }
    return payload
  }
  return toCreatePayload(formData)
}

watch(
  () => [props.currentRow, props.defaultDepartmentId, props.canAssign, props.canUpdateSensitive] as const,
  async ([currentRow, defaultDepartmentId, canAssign, canUpdateSensitive]) => {
    setFieldRemove('internalCost', !canUpdateSensitive)
    setFieldRemove('confidential', !canUpdateSensitive)
    setFieldRemove('departmentId', !canAssign)
    setFieldRemove('ownerId', !canAssign)

    if (!currentRow) {
      const departmentId = canAssign ? defaultDepartmentId || undefined : undefined
      await setValues({
        name: '',
        phone: '',
        remark: '',
        status: 'LEAD',
        dealAmount: '',
        internalCost: '',
        confidential: false,
        ownerId: undefined,
        departmentId
      })
      await loadOwners(departmentId, false)
      return
    }

    await setValues({
      id: currentRow.id,
      version: currentRow.version,
      name: currentRow.name,
      phone: currentRow.phone || '',
      remark: currentRow.remark || '',
      status: currentRow.status,
      dealAmount: currentRow.dealAmount,
      internalCost: currentRow.internalCost || '',
      confidential: currentRow.confidential,
      ownerId: currentRow.ownerId,
      departmentId: currentRow.departmentId
    })
    await loadOwners(canAssign ? currentRow.departmentId : undefined, false)
  },
  { immediate: true }
)

defineExpose({ submit })
</script>

<template>
  <Form :rules="rules" label-width="110px" @register="formRegister" :schema="formSchema" />
</template>
