<script setup lang="tsx">
import { forgotPasswordApi, getSmsCode } from '@/api/login'
import { BaseButton } from '@/components/Button'
import { Form, type FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { ElInput, ElMessage, type FormRules } from 'element-plus'
import { reactive, ref, unref } from 'vue'

const emit = defineEmits(['to-login'])

const { formRegister, formMethods } = useForm()
const { getElFormExpose, getFormData } = formMethods

const { t } = useI18n()

const { required, lengthRange, phone, numberLength } = useValidator()

const getCodeTime = ref(60)
const getCodeLoading = ref(false)
const loading = ref(false)

const schema = reactive<FormSchema[]>([
  {
    field: 'title',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return <h2 class="text-2xl font-bold text-center w-[100%]">{t('login.forgetPassword')}</h2>
        }
      }
    }
  },
  {
    field: 'phone',
    label: t('login.phone'),
    value: '',
    component: 'Input',
    colProps: {
      span: 24
    },
    componentProps: {
      placeholder: t('login.phone')
    }
  },
  {
    field: 'password',
    label: t('login.password'),
    value: '',
    component: 'InputPassword',
    colProps: {
      span: 24
    },
    componentProps: {
      style: {
        width: '100%'
      },
      strength: true,
      placeholder: t('login.passwordPlaceholder')
    }
  },
  {
    field: 'check_password',
    label: t('login.checkPassword'),
    value: '',
    component: 'InputPassword',
    colProps: {
      span: 24
    },
    componentProps: {
      style: {
        width: '100%'
      },
      placeholder: t('login.checkPassword')
    }
  },
  {
    field: 'code',
    label: t('login.code'),
    value: '',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: (formData) => {
          return (
            <div class="w-[100%] flex">
              <ElInput v-model={formData.code} placeholder={t('login.codePlaceholder')} />
              <BaseButton type="primary" disabled={unref(getCodeLoading)} class="ml-10px" onClick={getCode}>
                {t('login.getCode')}
                {unref(getCodeLoading) ? `(${unref(getCodeTime)})` : ''}
              </BaseButton>
            </div>
          )
        }
      }
    }
  },
  {
    field: 'submit',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return (
            <>
              <div class="w-[100%]">
                <BaseButton type="primary" class="w-[100%]" loading={loading.value} onClick={submitReset}>
                  {t('login.resetPassword')}
                </BaseButton>
              </div>
              <div class="w-[100%] mt-15px">
                <BaseButton class="w-[100%]" onClick={toLogin}>
                  {t('login.hasUser')}
                </BaseButton>
              </div>
            </>
          )
        }
      }
    }
  }
])

const toLogin = () => {
  emit('to-login')
}

const getCode = async () => {
  const formRef = await getElFormExpose()
  const isPhone = await formRef?.validateField('phone')
  if (!isPhone) {
    return ElMessage.error(t('login.phoneRequired'))
  }
  getCodeLoading.value = true
  const timer = setInterval(() => {
    getCodeTime.value--
    if (getCodeTime.value <= 0) {
      clearInterval(timer)
      getCodeTime.value = 60
      getCodeLoading.value = false
    }
  }, 1000)
  const formData = await getFormData()
  const { phone: phoneValue } = formData
  try {
    const res = await getSmsCode({ phone: phoneValue, type: 'reset' })
    if (res.code == 200) {
      ElMessage.success(res.message || t('login.codeSent'))
    } else {
      ElMessage.error(t('login.codeSendFailed'))
      clearInterval(timer)
      getCodeTime.value = 60
      getCodeLoading.value = false
    }
  } catch {
    clearInterval(timer)
    getCodeTime.value = 60
    getCodeLoading.value = false
  }
}

const validatecheckPwd = async (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  const formData = await getFormData()
  if (value !== formData.password) {
    callback(new Error(t('login.passwordMismatch')))
  } else {
    callback()
  }
}

const rules: FormRules = {
  phone: [required(), phone()],
  password: [required(), lengthRange({ min: 6, max: 16 })],
  check_password: [required(), { asyncValidator: validatecheckPwd, trigger: 'blur' }],
  code: [required(), numberLength(6)]
}

const submitReset = async () => {
  const formRef = await getElFormExpose()
  formRef?.validate(async (valid) => {
    if (!valid) return
    const formData = await getFormData()
    loading.value = true
    try {
      const { password, phone: phoneValue, code } = formData
      await forgotPasswordApi({ password, phone: phoneValue, code })
      ElMessage.success(t('login.resetPasswordSuccess'))
      toLogin()
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <Form
    :schema="schema"
    :rules="rules"
    label-position="top"
    hide-required-asterisk
    size="large"
    class="dark:(border-1 border-[var(--el-border-color)] border-solid)"
    @register="formRegister"
  />
</template>
