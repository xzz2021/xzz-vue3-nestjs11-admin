<script setup lang="tsx">
import { wechatLogin } from '@/api/login'
import { useAppStore } from '@/store/modules/app'
import { ElLink, ElMessage } from 'element-plus'
import { onMounted, onUnmounted, ref } from 'vue'
import { onBeforeRouteUpdate } from 'vue-router'
import BindForm from './BindForm.vue'
import { useLogin } from './hooks'
const WECHAT_REDIRECT_URL = import.meta.env.VITE_WECHAT_REDIRECT_URL
console.log('xzz2021: WECHAT_REDIRECT_URL', WECHAT_REDIRECT_URL)
const emit = defineEmits(['to-login'])
const toLogin = () => {
  emit('to-login')
}

const weixinState = ref(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)) // 混淆参数

const { isDark } = useAppStore()
onMounted(() => {
  const s = document.createElement('script')
  s.type = 'text/javascript'
  s.src = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js'
  const wxElement = document.body.appendChild(s)
  wxElement.onload = function () {
    // @ts-expect-error 上面全局挂载了WxLogin
    const obj = new WxLogin({
      self_redirect: !true,
      id: 'weixinLogin', // 需要显示的容器id
      appid: 'wxe1b07777734e93', // 微信开放平台appid wx*******
      scope: 'snsapi_login', //  网页默认即可
      redirect_uri: encodeURIComponent(WECHAT_REDIRECT_URL), // 授权成功后回调的url
      // https://xzz.com/?code=001jwj100IWKwT1KuD100J7adA2jwj1j&state=tduaqkxdvupveiucst1ou
      //  code=081pFdml242ERe4gg9ol27qAIx4pFdmU&state=ip2u2w3a7ef2xcl3sui0hk
      state: weixinState.value, // 可设置为简单的随机数加session用来校验
      style: isDark ? 'white' : 'black' // 提供"black"、"white"可选。二维码的样式
      // href: 'data:text/css;base64,LmltcG93ZXJCb3ggLnFyY29kZSB7bWFyZ2luLXRvcDowO30KLmltcG93ZXJCb3ggLnRpdGxlIHtkaXNwbGF5OiBub25lO30=' // 外部css文件url，需要https
    })
  }
  onUnmounted(() => {
    toBindPage.value = false
    document.body.removeChild(s)
  })
})

const { successLogin } = useLogin()
const wechatInfo = ref<any>(null)
const toBindPage = ref(false)
//  监听路由跳转  并拦截停留在当前页
onBeforeRouteUpdate(async (to) => {
  if (to.query?.code) {
    const { code, state } = to.query
    if (state === weixinState.value) {
      // 向后端发起登录请求
      try {
        const res = await wechatLogin(code as string)
        const { userinfo, access_token } = res.data
        if (access_token) {
          //  说明登录成功  设定token 路由跳转
          successLogin(userinfo, access_token)
          return
        } else if (userinfo) {
          // 说明 需要绑定信息  跳转绑定页
          wechatInfo.value = userinfo
          toBindPage.value = true
          return
        } else {
          ElMessage.error('扫码登录失败')
        }
      } catch (error) {
        console.error('xzz2021: onBeforeRouteUpdate -> error', error)
      }
    }
    return false
  }
})
</script>
<template>
  <div
    class="h-full flex justify-center items-center m-auto w-[100%] at-2xl:max-w-500px at-xl:max-w-500px at-md:max-w-500px at-lg:max-w-500px"
  >
    <div v-if="!toBindPage" class="flex flex-col items-center">
      <div id="weixinLogin" class=""></div>
      <ElLink type="primary" :underline="false" @click="toLogin">返回帐号登录</ElLink>
    </div>
    <div v-else class="flex flex-col items-center"> <BindForm :wechatInfo="wechatInfo" /></div>
  </div>
</template>
