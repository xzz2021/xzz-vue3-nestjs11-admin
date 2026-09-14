<template>
  <div class="txtpv">
    <el-card class="txtpv-card" shadow="hover">
      <template #header>
        <div class="toolbar">
          <div class="left">
            <span class="label">TXT 预览：</span>
          </div>
          <div class="right">
            <el-switch v-model="wrap" active-text="自动换行" />
            <el-divider direction="vertical" />
            <el-button size="small" :disabled="loading" @click="load">{{ loading ? '加载中…' : '重新加载' }}</el-button>
            <el-button size="small" text :disabled="!fullText" @click="copy">复制</el-button>
            <el-button v-if="loading" size="small" type="danger" text @click="abort">取消</el-button>
          </div>
        </div>
      </template>
      <pre ref="preEl" class="viewer">
        <template v-if="error">{{ error }}</template>
      </pre>
      <template #footer>
        <div class="status">
          <span v-if="loading">已接收 {{ formatBytes(bytesLoaded) }}</span>
          <span v-else>共 {{ formatBytes(bytesLoaded) }}</span>
          <span v-if="charset">({{ charset.toUpperCase() }})</span>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { formatBytes } from '@/utils/file'
import { ElButton, ElCard, ElDivider, ElMessage, ElSwitch } from 'element-plus'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 单个 TXT 链接（已保证存在） */
    url: string
    /** 文本编码，默认 utf-8；如需 gbk/big5，请传相应名称（浏览器支持度依环境而定） */
    charset?: string
    /** 传递给 fetch 的可选参数（如 headers、credentials 等） */
    fetchOptions?: RequestInit
  }>(),
  {
    charset: 'utf-8'
  }
)

const preEl = ref<HTMLPreElement | null>(null)
const loading = ref(true) // 组件挂载后立即开始加载
const error = ref('')
const bytesLoaded = ref(0)
const wrap = ref(true)
const fullText = ref('')
let controller: AbortController | null = null

const charset = props.charset

function abort() {
  if (controller) controller.abort()
}

async function copy() {
  try {
    await navigator.clipboard.writeText(fullText.value)
    ElMessage.success('已复制')
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = fullText.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('已复制')
  }
}

async function load() {
  abort()
  error.value = ''
  loading.value = true
  bytesLoaded.value = 0
  fullText.value = ''

  if (preEl.value) preEl.value.textContent = ''

  controller = new AbortController()
  try {
    const res = await fetch(props.url, { signal: controller.signal, ...props.fetchOptions })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    if (res.body) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder(props.charset)
      let buffer = ''
      let lastFlush = performance.now()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) {
          bytesLoaded.value += value.byteLength
          const chunkText = decoder.decode(value, { stream: true })
          fullText.value += chunkText
          buffer += chunkText
        }
        if (buffer.length > 1 << 16 || performance.now() - lastFlush > 120) {
          if (preEl.value && buffer) {
            preEl.value.append(document.createTextNode(buffer))
            buffer = ''
            lastFlush = performance.now()
          }
        }
      }
      const tail = new TextDecoder(props.charset).decode()
      if (preEl.value && tail) preEl.value.append(document.createTextNode(tail))
      if (preEl.value && buffer) preEl.value.append(document.createTextNode(buffer))
    } else {
      const text = await res.text()
      bytesLoaded.value = new Blob([text]).size
      fullText.value = text
      if (preEl.value) preEl.value.textContent = text
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    error.value = `加载失败：${e?.message || e}`
    if (preEl.value) preEl.value.textContent = error.value
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})

onBeforeUnmount(() => abort())
</script>

<style lang="less" scoped>
.txtpv {
  width: 60%;
  font-family:
    ui-sans-serif,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial;
  color: #111827;

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;

    .left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .label {
      color: #6b7280;
    }

    .url {
      max-width: 52vw;
      padding: 2px 6px;
      overflow: hidden;
      color: #374151;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: #f3f4f6;
      border-radius: 6px;
    }

    .right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}

.txtpv-card {
  .viewer {
    height: 60vh;
    // border: 1px solid #e5e7eb;
    // border-radius: 8px;
    padding: 12px;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre;
    background: #fff;
  }

  .status {
    font-size: 12px;
    color: #6b7280;
  }
}
</style>
