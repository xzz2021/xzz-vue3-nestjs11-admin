/// <reference types="vite/client" />

declare module 'virtual:svg-icons-register' {
  const component: unknown
  export default component
}

declare module 'virtual:svg-icons-names' {
  const iconsNames: string[]
  export default iconsNames
}

declare module '@wangeditor/editor-for-vue' {
  import type { DefineComponent } from 'vue'

  export const Editor: DefineComponent
  export const Toolbar: DefineComponent
}

interface WxLoginOptions {
  self_redirect: boolean
  id: string
  appid: string
  scope: string
  redirect_uri: string
  state: string
  style?: string
}

declare class WxLogin {
  constructor(options: WxLoginOptions)
}
