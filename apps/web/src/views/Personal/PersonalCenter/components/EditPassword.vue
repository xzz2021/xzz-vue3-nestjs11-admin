<script setup lang="ts">
import { updatePasswordApi } from '@/api/user'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { useUserStore } from '@/store/modules/user'
import { ElDivider, ElMessage, ElMessageBox } from 'element-plus'
import { reactive, ref } from 'vue'

const { t } = useI18n()
const userStore = useUserStore()
const { required } = useValidator()

const formSchema = reactive<FormSchema[]>([
  {
    field: 'password',
    label: t('personal.oldPassword'),
    component: 'InputPassword',
    colProps: {
      span: 24
    }
  },
  {
    field: 'newPassword',
    label: t('personal.newPassword'),
    component: 'InputPassword',
    colProps: {
      span: 24
    },
    componentProps: {
      strength: true
    }
  },
  {
    field: 'newPassword2',
    label: t('personal.confirmNewPassword'),
    component: 'InputPassword',
    colProps: {
      span: 24
    },
    componentProps: {
      strength: true
    }
  }
])

const { formRegister, formMethods } = useForm()
const { getFormData, getElFormExpose, setValues } = formMethods

const rules = reactive({
  password: [required()],
  newPassword: [
    required(),
    {
      asyncValidator: async (_, val, callback) => {
        const formData = await getFormData()
        const { newPassword2 } = formData
        if (val !== newPassword2) {
          callback(new Error(t('personal.passwordMismatch')))
        } else {
          callback()
        }
      }
    }
  ],
  newPassword2: [
    required(),
    {
      asyncValidator: async (_, val, callback) => {
        const formData = await getFormData()
        const { newPassword } = formData
        if (val !== newPassword) {
          callback(new Error(t('personal.confirmPasswordMismatch')))
        } else {
          callback()
        }
      }
    }
  ]
})

const saveLoading = ref(false)
const save = async () => {
  const userId = userStore.getUserInfo?.id
  if (!userId) {
    ElMessage.error(t('personal.userInfoError'))
    return
  }

  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch((err) => {
    console.error(err)
  })
  if (!valid) return

  ElMessageBox.confirm(t('personal.confirmModifyPassword'), t('common.tip'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  }).then(async () => {
    try {
      saveLoading.value = true
      const formData = await getFormData()
      await updatePasswordApi({
        id: userId,
        password: formData.password,
        newPassword: formData.newPassword
      })
      setValues({
        password: '',
        newPassword: '',
        newPassword2: ''
      })
      ElMessage.success(t('personal.passwordModifySuccess'))
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
  <BaseButton type="primary" :loading="saveLoading" @click="save">{{ t('personal.confirmModifyBtn') }}</BaseButton>
</template>
