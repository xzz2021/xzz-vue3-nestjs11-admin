<script setup lang="tsx">
import { getSmsCode, smsLoginApi } from '@/api/login'
import { BaseButton } from '@/components/Button'
import { Form, type FormSchema } from '@/components/Form'
import { Icon } from '@/components/Icon'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { useUserStore } from '@/store/modules/user'
import { ElInput, ElMessage } from 'element-plus'
import { onMounted, reactive, ref, unref } from 'vue'
import { useLogin } from './hooks'
const { required, phone } = useValidator()

const emit = defineEmits(['to-register', 'to-wechat', 'to-login'])

const userStore = useUserStore()

const { t } = useI18n()

const rules = {
  phone: [required(), phone()],
  code: [required()]
}

const schema = reactive<FormSchema[]>([
  {
    field: 'title',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return <h2 class="text-2xl font-bold text-center w-[100%]">{t('login.login')}</h2>
        }
      }
    }
  },
  {
    field: 'phone',
    label: t('login.phone'),
    // value: 'admin',
    component: 'Input',
    colProps: {
      span: 24
    }
    // componentProps: {
    //   // placeholder: 'admin or test'
    //   defaultValue: 13077908822
    // }
  },
  {
    field: 'code',
    label: t('login.code'),
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
    field: 'login',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return (
            <>
              <div class="w-[100%]">
                <BaseButton loading={loading.value} type="primary" class="w-[100%]" onClick={signIn}>
                  {t('login.login')}
                </BaseButton>
              </div>
            </>
          )
        }
      }
    }
  },
  {
    field: 'other',
    component: 'Divider',
    label: t('login.otherLogin'),
    componentProps: {
      contentPosition: 'center'
    }
  },
  {
    field: 'otherIcon',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return (
            <>
              <div class="flex justify-between w-[100%]">
                <div onClick={toLogin}>
                  <Icon
                    icon="lock"
                    size={iconSize}
                    class="cursor-pointer ant-icon"
                    color={iconColor}
                    hoverColor={hoverColor}
                  />
                </div>
                <div onClick={toWechat}>
                  <Icon
                    icon="message-circle"
                    size={iconSize}
                    class="cursor-pointer ant-icon"
                    color={iconColor}
                    hoverColor={hoverColor}
                  />
                </div>
                <Icon
                  icon="coins"
                  size={iconSize}
                  color={iconColor}
                  hoverColor={hoverColor}
                  class="cursor-pointer ant-icon"
                />
                <Icon
                  icon="share-2"
                  size={iconSize}
                  color={iconColor}
                  hoverColor={hoverColor}
                  class="cursor-pointer ant-icon"
                />
              </div>
            </>
          )
        }
      }
    }
  }
])

const iconSize = 30

const initLoginInfo = () => {
  const loginInfo = userStore.getLoginInfo
  if (loginInfo) {
    const { phone } = loginInfo
    setValues({ phone })
  }
}

const getCodeTime = ref(60)
const getCodeLoading = ref(false)
const getCode = async () => {
  const formRef = await getElFormExpose()
  const isPhone = await formRef?.validateField('phone')
  if (!isPhone) {
    return ElMessage.error('请输入手机号')
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
  // 向后端请求发送验证码
  const formData = await getFormData()
  const { phone } = formData
  const res = await getSmsCode({ phone, type: 'login' })
  if (res?.code === 200) {
    ElMessage.success('验证码发送成功')
  } else {
    ElMessage.error('验证码发送失败')
  }
}

const toWechat = () => {
  emit('to-wechat')
}

const toLogin = () => {
  emit('to-login')
}

onMounted(() => {
  initLoginInfo()
})

const { formRegister, formMethods } = useForm()
const { getFormData, getElFormExpose, setValues } = formMethods

const loading = ref(false)

const iconColor = '#999'
const hoverColor = 'var(--el-color-primary)'
const { successLogin } = useLogin()
// 登录
const signIn = async () => {
  const formRef = await getElFormExpose()
  await formRef?.validate(async (isValid) => {
    if (isValid) {
      loading.value = true
      const formData = await getFormData<{ phone: string; code: string }>()

      const res = await smsLoginApi(formData).finally(() => {
        loading.value = false
      })
      const { access_token, userinfo } = res.data
      if (access_token && userinfo) {
        await successLogin(userinfo, access_token)
      }
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
