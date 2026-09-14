<script lang="ts" setup>
import { updatePersonApi } from '@/api/user'
import type { PersonalUserDetail } from '@/api/user/types'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { ElDivider, ElMessage, ElMessageBox } from 'element-plus'
import { type PropType, reactive, ref, watch } from 'vue'

const props = defineProps({
  userInfo: {
    type: Object as PropType<PersonalUserDetail | undefined>,
    default: () => undefined
  }
})

const emit = defineEmits<{
  success: []
}>()

const { t } = useI18n()
const { required, phone, maxlength, email } = useValidator()

const formSchema = reactive<FormSchema[]>([
  {
    field: 'username',
    label: t('personal.username'),
    component: 'Input',
    colProps: {
      span: 24
    }
  },
  {
    field: 'phone',
    label: t('personal.phoneNumber'),
    component: 'Input',
    colProps: {
      span: 24
    }
  },
  {
    field: 'email',
    label: t('personal.email'),
    component: 'Input',
    colProps: {
      span: 24
    }
  }
])

const rules = reactive({
  username: [required(), maxlength(50)],
  phone: [required(), phone()],
  email: [email()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

watch(
  () => props.userInfo,
  (value) => {
    if (!value) return
    setValues({
      username: value.username ?? '',
      phone: value.phone ?? '',
      email: value.email ?? ''
    })
  },
  {
    immediate: true,
    deep: true
  }
)

const saveLoading = ref(false)
const save = async () => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch((err) => {
    console.error(err)
  })
  if (!valid || !props.userInfo?.id) return

  ElMessageBox.confirm(t('personal.confirmModify'), t('common.tip'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  }).then(async () => {
    try {
      saveLoading.value = true
      const formData = await getFormData()
      await updatePersonApi({
        id: props.userInfo!.id,
        username: formData.username,
        phone: formData.phone,
        email: formData.email || undefined
      })
      ElMessage.success(t('personal.modifySuccess'))
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      saveLoading.value = false
    }
  })
}
</script>

<template>
  <Form :rules="rules" @register="formRegister" :schema="formSchema" />
  <ElDivider />
  <BaseButton type="primary" :loading="saveLoading" @click="save">{{ t('exampleDemo.save') }}</BaseButton>
</template>
