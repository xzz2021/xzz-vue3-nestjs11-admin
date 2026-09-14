<script setup lang="tsx">
import { Form, type FormSchema } from '@/components/Form'
import { reactive, ref, unref } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'
import { useForm } from '@/hooks/web/useForm'
import { ElInput, ElMessage, type FormRules } from 'element-plus'
import { useValidator } from '@/hooks/web/useValidator'
import { BaseButton } from '@/components/Button'
import { getSmsCode, wechatBind } from '@/api/login'
import { useLogin } from './hooks'

const { formRegister, formMethods } = useForm()
const { getElFormExpose, getFormData } = formMethods

const { t } = useI18n()

const { required, lengthRange, phone, numberLength } = useValidator()

const props = defineProps<{
  wechatInfo: any
}>()

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
  const res = await getSmsCode({ phone, type: 'bind' })
  console.log('xzz2021: getCode -> res', res)
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
          return <h2 class="text-2xl font-bold text-center w-[100%]">绑定信息</h2>
        }
      }
    }
  },
  {
    field: 'avatar',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return (
            <div class="flex items-center w-full justify-center">
              {props.wechatInfo.avatar ? (
                <img src={props.wechatInfo.avatar} alt="" class="w-[60px] h-[60px] rounded-full" />
              ) : (
                <></>
              )}
            </div>
          )
        }
      }
    }
  },
  {
    field: 'username',
    label: t('login.username'),
    value: props.wechatInfo.username,
    component: 'Input',
    colProps: {
      span: 24
    },
    componentProps: {
      placeholder: t('login.usernamePlaceholder')
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
      placeholder: t('login.phonePlaceholder')
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
      strength: true,
      placeholder: t('login.passwordPlaceholder')
    }
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
    field: 'register',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return (
            <>
              <div class="w-[100%]">
                <BaseButton type="primary" class="w-[100%]" loading={loading.value} onClick={loginRegister}>
                  确认绑定
                </BaseButton>
              </div>
            </>
          )
        }
      }
    }
  }
])

const validatecheckPwd = async (_rule: any, value: any, callback: any) => {
  const formData = await getFormData()
  if (value !== formData.password) {
    callback(new Error('两次输入的密码不一致!'))
  } else {
    callback()
  }
}
const rules: FormRules = {
  username: [required(), lengthRange({ min: 2, max: 16 })],
  phone: [required(), phone()],
  password: [required(), lengthRange({ min: 6, max: 16 })],
  check_password: [required(), { asyncValidator: validatecheckPwd, trigger: 'blur' }],
  code: [required(), numberLength(6)]
  // iAgree: [required()]
}

const loading = ref(false)

const { successLogin } = useLogin()

const loginRegister = async () => {
  const formRef = await getElFormExpose()
  formRef?.validate(async (valid) => {
    if (valid) {
      try {
        const formData = await getFormData()
        console.log('xzz2021: loginRegister -> formData', formData)
        console.log('xzz2021: loginRegister -> props.wechatInfo', props.wechatInfo)
        const res = await wechatBind({ ...formData, ...props.wechatInfo })
        const { userinfo, access_token } = res.data
        if (access_token) {
          //  说明登录成功  设定token 路由跳转
          successLogin(userinfo, access_token)
        } else {
          ElMessage.error('绑定失败')
        }
      } catch (error) {
        console.error('xzz2021: onBeforeRouteUpdate -> error', error)
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
