import { resolve } from 'node:path'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv, type ConfigEnv, type PluginOption } from 'vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'

const root = process.cwd()
const srcDir = resolve(root, 'src')

export default defineConfig(({ command, mode }: ConfigEnv) => {
  const env = loadEnv(mode, root)
  const isBuild = command === 'build'
  const dropConsole = env.VITE_DROP_CONSOLE === 'true'
  const dropDebugger = env.VITE_DROP_DEBUGGER === 'true'
  const elementPlusImportStyle = env.VITE_USE_ALL_ELEMENT_PLUS_STYLE === 'false' ? 'css' : false
  const lessVariables = resolve(root, 'src/styles/variables.module.less').replaceAll('\\', '/')

  const plugins: PluginOption[] = [
    UnoCSS(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver({ importStyle: elementPlusImportStyle })],
      dts: resolve(root, 'types/auto-imports.d.ts')
    }),
    Components({
      dirs: [],
      directives: false,
      resolvers: [ElementPlusResolver({ importStyle: elementPlusImportStyle })],
      dts: resolve(root, 'types/auto-components.d.ts')
    }),
    vue(),
    vueJsx(),
    VueI18nPlugin({
      runtimeOnly: true,
      compositionOnly: true,
      include: [resolve(root, 'src/locales/**')]
    }),
    createSvgIconsPlugin({
      iconDirs: [resolve(srcDir, 'assets/svgs')],
      symbolId: 'icon-[dir]-[name]',
      svgoOptions: true
    })
  ]

  if (isBuild && env.VITE_USE_BUNDLE_ANALYZER === 'true') {
    plugins.push(visualizer({ filename: 'stats.html', gzipSize: true }) as PluginOption)
  }

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins,
    css: {
      preprocessorOptions: {
        less: {
          additionalData: `@import "${lessVariables}";`,
          javascriptEnabled: true
        }
      }
    },
    resolve: {
      alias: {
        '@': srcDir
      }
    },
    build: {
      outDir: env.VITE_OUT_DIR || 'dist',
      sourcemap: env.VITE_SOURCEMAP === 'true',
      reportCompressedSize: false,
      cssCodeSplit: env.VITE_USE_CSS_SPLIT !== 'false',
      chunkSizeWarningLimit: 1500,
      rolldownOptions: {
        output: {
          ...(dropConsole || dropDebugger
            ? {
                minify: {
                  compress: {
                    dropConsole,
                    dropDebugger
                  }
                }
              }
            : {}),
          codeSplitting: {
            groups: [
              { name: 'vue-chunks', test: /[\\/]node_modules[\\/](vue|vue-router|pinia|vue-i18n)(?:[\\/]|$)/ },
              { name: 'element-plus', test: /[\\/]node_modules[\\/]element-plus(?:[\\/]|$)/ },
              { name: 'wang-editor', test: /[\\/]node_modules[\\/]@wangeditor[\\/]/ },
              { name: 'echarts', test: /[\\/]node_modules[\\/](echarts|echarts-wordcloud)(?:[\\/]|$)/ }
            ]
          }
        }
      }
    },
    server: {
      host: true,
      port: 4000,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      hmr: {
        overlay: false
      },
      watch: {
        ignored: ['**/dist/**', '**/dist-pro/**', '**/dist-dev/**']
      }
    },
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'vue-types',
        'pinia',
        'element-plus/es/locale/lang/zh-cn',
        'element-plus/es/locale/lang/en',
        '@vueuse/core',
        'axios',
        'qs',
        'echarts',
        'echarts-wordcloud',
        '@wangeditor/editor',
        '@wangeditor/editor-for-vue',
        'vue-json-pretty',
        '@zxcvbn-ts/core',
        'dayjs',
        'cropperjs'
      ]
    }
  }
})
