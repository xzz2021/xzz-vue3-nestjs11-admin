<script setup lang="ts">
import type { CreateUserPayload, UpdateUserPayload, UserItem } from '@/api/user/types'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { useDepartmentStore } from '@/store/modules/department'
import { useRoleStore } from '@/store/modules/role'
import { type PropType, reactive, watch } from 'vue'

const { t } = useI18n()
const { required } = useValidator()
const departmentStore = useDepartmentStore()
const roleStore = useRoleStore()

/*
  如果没有请求到下拉列表,则根据已有数据 自己构造???
  3种方案:
  1.必须确保下拉列表有数据
  2.自己根据已有数据构造下拉列表
  3. 改造form组件,允许下拉列表为空[]
  const toRoleSelectOptions = (roles: UserItem['roles'] = []) =>
    (roles || []).flatMap((role) => {
      if (typeof role === 'string') return [{ label: role, value: role }]
      if (role?.id) return [{ label: role.name || role.id, value: role.id }]
      return []
    })
*/

const props = defineProps({
  currentRow: {
    type: Object as PropType<UserItem | undefined>,
    default: () => undefined
  },
  defaultDepartmentId: {
    type: String,
    default: ''
  }
})

const formSchema = reactive<FormSchema[]>([
  {
    field: 'username',
    label: t('userDemo.username'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'phone',
    label: t('login.phone'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'password',
    label: t('userDemo.password'),
    component: 'InputPassword',
    colProps: { span: 24 },
    hidden: !!props.currentRow
  },
  {
    field: 'department',
    label: t('userDemo.department'),
    component: 'TreeSelect',
    colProps: { span: 24 },
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
      defaultExpandAll: true
    },
    optionApi: () => unref(departmentStore.list)
  },
  {
    field: 'roles',
    label: t('userDemo.role'),
    component: 'Select',
    value: [],
    colProps: { span: 24 },
    componentProps: {
      multiple: true,
      collapseTags: true,
      maxCollapseTags: 2
    },
    // optionApi: async () => {
    //   const list = (await roleStore.ensureList()) || []
    //   const options = list.map((role) => ({ label: role.name, value: role.id }))
    //   for (const extra of toRoleSelectOptions(props.currentRow?.roles)) {
    //     if (!options.some((item) => item.value === extra.value)) options.push(extra)
    //   }
    //   return options
    // },
    // optionApi: async () =>
    //   unref(await roleStore.ensureList()).map((role) => ({
    //     label: role.name,
    //     value: role.id,
    //   })),
    optionApi: () =>
      unref(roleStore.list).map((role) => ({
        label: role.name,
        value: role.id
      }))
  },
  {
    field: 'email',
    label: t('userDemo.email'),
    component: 'Input',
    colProps: { span: 24 }
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

const rules = reactive<Record<string, ReturnType<typeof required>[]>>({
  username: [required()],
  phone: [required()],
  department: [required()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

export type UserFormData = CreateUserPayload | UpdateUserPayload

const submit = async (): Promise<UserFormData | undefined> => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch(() => false)
  if (!valid) return

  const formData = await getFormData(false)
  const payload = {
    username: formData.username,
    phone: formData.phone,
    department: formData.department,
    roles: formData.roles || [],
    email: formData.email || undefined,
    enabled: formData.enabled ?? true
  }

  if (formData.id) {
    return { ...payload, id: formData.id }
  }

  return { ...payload, password: formData.password }
}

watch(
  () => [props.currentRow, props.defaultDepartmentId] as const,
  ([currentRow, defaultDepartmentId]) => {
    const passwordField = formSchema.find((item) => item.field === 'password')
    if (passwordField) {
      passwordField.hidden = !!currentRow
    }
    if (!currentRow) {
      rules.password = [required()]
      setValues({
        username: '',
        phone: '',
        password: '',
        department: defaultDepartmentId || undefined,
        roles: [],
        email: '',
        enabled: true
      })
      // 清空验证
      // const elForm = await getElFormExpose()
      // const valid = await elForm?.clearValidate()
      return
    }

    delete rules.password
    setValues({
      id: currentRow.id,
      username: currentRow.username,
      phone: currentRow.phone,
      department: currentRow.department?.id || '',
      roles: currentRow.roles?.map((role: any) => role.id) || [],
      email: currentRow.email || '',
      enabled: currentRow.enabled ?? true
    })
  },
  { immediate: true }
)

defineExpose({ submit })
</script>

<template>
  <Form :rules="rules" label-width="96px" @register="formRegister" :schema="formSchema" />
</template>
