<script setup lang="tsx">
import { getCaptchaApi, loginApi } from '@/api/login'
import type { UserLoginFormType, UserLoginType } from '@/api/login/types'
import { BaseButton } from '@/components/Button'
import { Form, type FormSchema } from '@/components/Form'
import { Icon } from '@/components/Icon'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { useUserStore } from '@/store/modules/user'
import { CAPTCHA_TEXT_COOKIE, clearCookie, setCookie } from '@/utils/cookie'
import { AxiosError } from 'axios'
import { ElCheckbox, ElLink, ElMessage } from 'element-plus'
import { onMounted, reactive, ref, unref } from 'vue'
import { useLogin } from './hooks'

const { required } = useValidator()
const { successLogin } = useLogin()

const emit = defineEmits(['to-register', 'to-wechat', 'to-sms', 'to-forgot'])

const userStore = useUserStore()

const { t } = useI18n()

const captchaSvg = ref('')

const updateCaptcha = async () => {
  clearCookie(CAPTCHA_TEXT_COOKIE)
  const res = await getCaptchaApi()
  captchaSvg.value = res.data.svg
}
updateCaptcha()

const rules = {
  // username: [required()],
  phone: [required()],
  password: [required()],
  captchaText: [required()]
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
    componentProps: {
      // 用于demo快速登录
      placeholder: '13011112222'
    },
    component: 'Input',
    colProps: {
      span: 24
    }
  },
  {
    field: 'password',
    label: t('login.password'),
    component: 'InputPassword',
    colProps: {
      span: 24
    },
    componentProps: {
      placeholder: '123456'
    }
  },
  {
    field: 'captchaText',
    label: t('login.code'),
    component: 'Input',
    colProps: {
      span: 24
    },
    componentProps: {
      slots: {
        suffix: () => {
          return <div v-html={captchaSvg.value} class="cursor-pointer leading-0" onClick={updateCaptcha}></div>
        }
      },
      // 按下enter键触发登录
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          signIn()
        }
      }
    }
  },
  {
    field: 'tool',
    colProps: {
      span: 24
    },
    formItemProps: {
      slots: {
        default: () => {
          return (
            <>
              <div class="flex justify-between items-center w-[100%]">
                <ElCheckbox v-model={remember.value} label={t('login.remember')} size="small" />
                <ElLink type="primary" underline="never" onClick={toForgot}>
                  {t('login.forgetPassword')}
                </ElLink>
              </div>
            </>
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
              <div class="w-[100%] mt-15px">
                <BaseButton class="w-[100%]" onClick={toRegister}>
                  {t('login.register')}
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
              <div class="flex justify-around w-[100%]">
                <div onClick={toSms}>
                  <Icon
                    icon="message-circle"
                    size={iconSize}
                    class="cursor-pointer ant-icon"
                    color={iconColor}
                    hoverColor={hoverColor}
                  />
                </div>
                <div onClick={toWechat}>
                  <Icon
                    icon="messages-square"
                    size={iconSize}
                    class="cursor-pointer ant-icon"
                    color={iconColor}
                    hoverColor={hoverColor}
                  />
                </div>
                {/* <div>
                  <Icon
                    icon="coins"
                    size={iconSize}
                    color={iconColor}
                    hoverColor={hoverColor}
                    class="cursor-pointer ant-icon"
                  />
                </div>
                <div>
                  <Icon
                    icon="share-2"
                    size={iconSize}
                    color={iconColor}
                    hoverColor={hoverColor}
                    class="cursor-pointer ant-icon"
                  />
                </div> */}
              </div>
            </>
          )
        }
      }
    }
  }
])

const { formRegister, formMethods } = useForm()
const { getFormData, getElFormExpose, setValues } = formMethods

const iconSize = 30

const remember = ref(userStore.getRememberMe)

onMounted(() => {
  setValues(userStore.getLoginInfo || {})
})

const loading = ref(false)

const iconColor = '#999'

const hoverColor = 'var(--el-color-primary)'

// 去注册页面
const toRegister = () => {
  emit('to-register')
}

const toForgot = () => {
  emit('to-forgot')
}

const toWechat = () => {
  ElMessage.warning('需要设置微信开放平台appid才能使用!')
}

const toSms = () => {
  ElMessage.warning('体验模式,暂不开放!')
}

const signIn = async () => {
  const formRef = await getElFormExpose()
  await formRef?.validate(async (isValid) => {
    //  开启全局加载蒙层
    ElLoading.service({
      lock: true,
      text: '正在登陆',
      background: 'rgba(0, 0, 0, 0.7)'
    })
    if (isValid) {
      loading.value = true
      const formData = await getFormData<UserLoginFormType>()
      try {
        setCookie(CAPTCHA_TEXT_COOKIE, formData.captchaText)
        const { phone, password } = formData
        const res = await loginApi({ phone, password } satisfies UserLoginType)
        const { userinfo, access_token } = res.data
        // 是否记住我
        if (unref(remember)) {
          userStore.setLoginInfo({
            phone: formData.phone
          })
        } else {
          userStore.setLoginInfo(undefined)
        }
        userStore.setRememberMe(unref(remember))
        await successLogin(userinfo, access_token)
      } catch (error) {
        // console.log('xzz2021: signIn -> error', error)
        ElLoading.service().close()
        if (error instanceof AxiosError && error.response?.data?.message === '验证码已过期') {
          // 只有当后面的登录失败时，才更新验证码
          updateCaptcha()
        } else if (error instanceof Error && !(error instanceof AxiosError)) {
          ElMessage.error(error.message)
        }
      } finally {
        // ElLoading.service().close()  改为进入的第一个组件里关闭
        loading.value = false
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
