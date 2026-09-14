/// <reference types="vite/client" />

declare module 'virtual:svg-icons-register' {
  const component: any
  export default component
}

declare module 'virtual:svg-icons-names' {
  const iconsNames: string[]
  export default iconsNames
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
