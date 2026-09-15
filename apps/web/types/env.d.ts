/// <reference types="vite/client" />

declare module 'virtual:svg-icons-register' {
  const component: any
  export default component
}

declare module 'virtual:svg-icons-names' {
  const iconsNames: string[]
  export default iconsNames
}

declare module '@wangeditor/editor-for-vue' {
  import type { DefineComponent } from 'vue'

  export const Editor: DefineComponent<Record<string, any>, Record<string, any>, any>
  export const Toolbar: DefineComponent<Record<string, any>, Record<string, any>, any>
}
