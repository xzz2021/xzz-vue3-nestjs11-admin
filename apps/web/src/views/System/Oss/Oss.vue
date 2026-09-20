<script setup lang="ts">
import {
  copyOssObjectsApi,
  createOssFolderApi,
  deleteOssObjectsApi,
  downloadOssFolderApi,
  getOssConfigApi,
  getOssListApi,
  presignOssGetApi
} from '@/api/oss'
import type { OssConfig, OssFileItem, OssFolderItem, OssListItem } from '@/api/oss/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { formatToDateTime } from '@/utils/dateUtil'
import { breadcrumbSegments, joinRelativeKey, OssKeyError } from '@/utils/dangerousFilename'
import { formatFileSize, getFileIcon2 } from '@/utils/file'
import { getRoutePermissions } from '@/utils/route-permission'
import { useClipboard } from '@vueuse/core'
import {
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElCheckbox,
  ElEmpty,
  ElMessage,
  ElMessageBox,
  ElTable,
  ElTableColumn
} from 'element-plus'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OssMoveDialog from './components/OssMoveDialog.vue'
import OssUploadQueue from './components/OssUploadQueue.vue'
import { previewOssFile } from './components/utils'
import type { OssQueueFile } from './components/OssUploadQueue.vue'

type ViewMode = 'list' | 'grid'

const VIEW_MODE_KEY = 'oss-view-mode'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { copy } = useClipboard()

const prefix = computed(() => String(route.query.prefix || ''))
const crumbs = computed(() => breadcrumbSegments(prefix.value))
const config = ref<OssConfig | null>(null)
const unavailable = ref(false)
const loading = ref(false)
const truncated = ref(false)
const nextToken = ref<string | null>(null)
const folders = ref<OssFolderItem[]>([])
const files = ref<OssFileItem[]>([])
const nameFilter = ref('')
const viewMode = ref<ViewMode>((localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'list')
const selected = ref<OssListItem[]>([])
const context = ref<{ visible: boolean; x: number; y: number; item: OssListItem | null }>({
  visible: false,
  x: 0,
  y: 0,
  item: null
})
const moveOpen = ref(false)
const dropActive = ref(false)
const queueFiles = ref<OssQueueFile[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const tableRef = ref<{ clearSelection?: () => void }>()

const pickFiles = () => fileInput.value?.click()
const pickFolder = () => folderInput.value?.click()

const canAdd = () => {
  return getRoutePermissions(route.meta).includes('oss:add')
}
const canDelete = () => {
  return getRoutePermissions(route.meta).includes('oss:delete')
}

const items = computed<OssListItem[]>(() => {
  const keyword = nameFilter.value.trim().toLowerCase()
  const list: OssListItem[] = [
    ...folders.value.map((folder) => ({ kind: 'folder' as const, ...folder })),
    ...files.value.map((file) => ({ kind: 'file' as const, ...file }))
  ]
  if (!keyword) return list
  return list.filter((item) => item.name.toLowerCase().includes(keyword))
})

const setPrefix = (next: string) => {
  void router.replace({ query: next ? { prefix: next } : {} })
}

const loadConfig = async () => {
  try {
    const res = await getOssConfigApi()
    config.value = res.data
    unavailable.value = false
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    unavailable.value = status === 503 || status === 0 || !status
    if (!unavailable.value) ElMessage.error(t('oss.loadFailed'))
  }
}

const loadList = async (append = false) => {
  if (unavailable.value) return
  loading.value = true
  try {
    const res = await getOssListApi({
      prefix: prefix.value,
      continuationToken: append ? nextToken.value || undefined : undefined
    })
    const data = res.data
    if (append) {
      folders.value = [...folders.value, ...data.folders]
      files.value = [...files.value, ...data.files]
    } else {
      folders.value = data.folders
      files.value = data.files
      selected.value = []
      tableRef.value?.clearSelection?.()
    }
    nextToken.value = data.nextContinuationToken
    truncated.value = data.truncated
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status === 503) {
      unavailable.value = true
      return
    }
    ElMessage.error(t('oss.loadFailed'))
  } finally {
    loading.value = false
  }
}

watch(
  () => route.query.prefix,
  () => {
    void loadList(false)
  }
)

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  localStorage.setItem(VIEW_MODE_KEY, mode)
}

const rowKey = (row: OssListItem) => (row.kind === 'folder' ? row.prefix : row.key)

const onTableSelection = (rows: OssListItem[]) => {
  selected.value = rows
}

const toggleSelect = (item: OssListItem, checked: boolean) => {
  if (checked) {
    if (!selected.value.some((row) => rowKey(row) === rowKey(item))) selected.value = [...selected.value, item]
  } else {
    selected.value = selected.value.filter((row) => rowKey(row) !== rowKey(item))
  }
}

const isSelected = (item: OssListItem) => selected.value.some((row) => rowKey(row) === rowKey(item))

const hideContext = () => {
  context.value.visible = false
}

const onContext = (event: MouseEvent, item: OssListItem) => {
  event.preventDefault()
  event.stopPropagation()
  context.value = { visible: true, x: event.clientX, y: event.clientY, item }
}

const openItem = (item: OssListItem) => {
  hideContext()
  if (item.kind === 'folder') {
    setPrefix(item.prefix)
    return
  }
  void previewOssFile(item)
}

const downloadItem = async (item: OssListItem) => {
  hideContext()
  try {
    if (item.kind === 'folder') {
      const file = await downloadOssFolderApi({ prefix: item.prefix })
      const url = window.URL.createObjectURL(file.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${item.name}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      ElMessage.success(t('oss.downloadSuccess'))
      return
    }
    const res = await presignOssGetApi({ key: item.key, disposition: 'attachment' })
    window.open(res.data.url, '_blank')
  } catch {
    ElMessage.error(t('oss.downloadFailed'))
  }
}

const copyTempUrl = async (item: OssListItem) => {
  hideContext()
  if (item.kind !== 'file') return
  try {
    const res = await presignOssGetApi({ key: item.key, disposition: 'inline' })
    await copy(res.data.url)
    ElMessage.success(t('oss.urlCopied', { seconds: res.data.expiresIn }))
  } catch {
    ElMessage.error(t('oss.copyFailed'))
  }
}

const createFolder = async () => {
  try {
    const { value } = await ElMessageBox.prompt(t('oss.folderName'), t('oss.createFolder'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      inputPattern: /^[^\\/]+$/,
      inputErrorMessage: t('oss.invalidName')
    })
    await createOssFolderApi({ prefix: prefix.value, name: value.trim() })
    ElMessage.success(t('oss.createFolderSuccess'))
    await loadList(false)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error((error as Error).message || t('oss.createFolderFailed'))
  }
}

const renameItem = async (item: OssListItem) => {
  hideContext()
  try {
    const { value } = await ElMessageBox.prompt(t('oss.newName'), t('oss.rename'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      inputValue: item.name,
      inputPattern: /^[^\\/]+$/,
      inputErrorMessage: t('oss.invalidName')
    })
    const destinationName = value.trim()
    const payload = {
      sources: [{ key: item.kind === 'folder' ? item.prefix : item.key, isFolder: item.kind === 'folder' }],
      destinationPrefix: prefix.value,
      destinationName
    }
    try {
      await copyOssObjectsApi(payload)
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status !== 409) throw error
      await ElMessageBox.confirm(t('oss.overwriteConfirm'), t('oss.rename'), { type: 'warning' })
      await copyOssObjectsApi({ ...payload, overwrite: true })
    }
    ElMessage.success(t('oss.renameSuccess'))
    await loadList(false)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(t('oss.renameFailed'))
  }
}

const targetsForMove = computed(() =>
  selected.value.length ? selected.value : context.value.item ? [context.value.item] : []
)

const openMove = (item?: OssListItem) => {
  hideContext()
  if (item) selected.value = [item]
  if (!targetsForMove.value.length) {
    ElMessage.warning(t('oss.selectFirst'))
    return
  }
  moveOpen.value = true
}

const confirmMove = async (destinationPrefix: string) => {
  const payload = {
    sources: targetsForMove.value.map((item) => ({
      key: item.kind === 'folder' ? item.prefix : item.key,
      isFolder: item.kind === 'folder'
    })),
    destinationPrefix
  }
  try {
    try {
      await copyOssObjectsApi(payload)
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status !== 409) throw error
      await ElMessageBox.confirm(t('oss.overwriteConfirm'), t('oss.move'), { type: 'warning' })
      await copyOssObjectsApi({ ...payload, overwrite: true })
    }
    ElMessage.success(t('oss.moveSuccess'))
    moveOpen.value = false
    await loadList(false)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(t('oss.moveFailed'))
  }
}

const deleteItems = async (rows: OssListItem[]) => {
  hideContext()
  if (!rows.length) {
    ElMessage.warning(t('oss.selectFirst'))
    return
  }
  try {
    await ElMessageBox.confirm(t('oss.deleteConfirm'), t('common.delWarning'), { type: 'warning' })
    await deleteOssObjectsApi({
      keys: rows.map((item) => ({
        key: item.kind === 'folder' ? item.prefix : item.key,
        isFolder: item.kind === 'folder'
      }))
    })
    ElMessage.success(t('oss.deleteSuccess'))
    await loadList(false)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(t('oss.deleteFailed'))
  }
}

const collectDroppedFiles = async (dataTransfer: DataTransfer): Promise<OssQueueFile[]> => {
  const result: OssQueueFile[] = []
  const walk = async (entry: FileSystemEntry, path: string) => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        ;(entry as FileSystemFileEntry).file(resolve, reject)
      })
      const relativePath = `${path}${file.name}`
      const joined = joinRelativeKey(prefix.value, relativePath)
      result.push({ file, prefix: joined.prefix, filename: joined.filename })
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const readAll = async (): Promise<FileSystemEntry[]> => {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
        if (!batch.length) return []
        return [...batch, ...(await readAll())]
      }
      for (const child of await readAll()) {
        await walk(child, `${path}${entry.name}/`)
      }
    }
  }
  const items = Array.from(dataTransfer.items)
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.()
    if (entry) {
      await walk(entry, '')
    } else if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        const joined = joinRelativeKey(prefix.value, file.name)
        result.push({ file, prefix: joined.prefix, filename: joined.filename })
      }
    }
  }
  return result
}

const enqueueFiles = (picked: OssQueueFile[]) => {
  queueFiles.value = picked
}

const onPickFiles = (event: Event) => {
  const input = event.target as HTMLInputElement
  const list = Array.from(input.files || []).map((file) => {
    const joined = joinRelativeKey(prefix.value, file.webkitRelativePath || file.name)
    return { file, prefix: joined.prefix, filename: joined.filename }
  })
  enqueueFiles(list)
  input.value = ''
}

const onDrop = async (event: DragEvent) => {
  dropActive.value = false
  event.preventDefault()
  if (!event.dataTransfer || !canAdd()) return
  try {
    enqueueFiles(await collectDroppedFiles(event.dataTransfer))
  } catch (error) {
    if (error instanceof OssKeyError) ElMessage.error(t('oss.invalidName'))
    else ElMessage.error(t('oss.uploadFailed'))
  }
}

const onWindowClick = () => hideContext()

onMounted(async () => {
  window.addEventListener('click', onWindowClick)
  await loadConfig()
  if (!unavailable.value) await loadList(false)
})

onUnmounted(() => {
  window.removeEventListener('click', onWindowClick)
})
</script>

<template>
  <ContentWrap>
    <ElEmpty v-if="unavailable" :description="t('oss.unavailable')" />
    <template v-else>
      <div class="mb-12px flex flex-wrap items-center justify-between gap-10px">
        <ElBreadcrumb separator="/">
          <ElBreadcrumbItem>
            <span class="cursor-pointer hover:text-[var(--el-color-primary)]" @click="setPrefix('')">
              {{ t('oss.root') }}
            </span>
          </ElBreadcrumbItem>
          <ElBreadcrumbItem v-for="item in crumbs" :key="item.prefix">
            <span class="cursor-pointer hover:text-[var(--el-color-primary)]" @click="setPrefix(item.prefix)">
              {{ item.name }}
            </span>
          </ElBreadcrumbItem>
        </ElBreadcrumb>
        <div class="flex items-center gap-8px">
          <BaseButton :plain="viewMode !== 'list'" @click="setViewMode('list')">{{ t('oss.listView') }}</BaseButton>
          <BaseButton :plain="viewMode !== 'grid'" @click="setViewMode('grid')">{{ t('oss.gridView') }}</BaseButton>
        </div>
      </div>

      <div class="mb-10px flex flex-wrap items-center gap-8px">
        <input v-if="canAdd()" ref="fileInput" class="hidden" type="file" multiple @change="onPickFiles" />
        <input v-if="canAdd()" ref="folderInput" class="hidden" type="file" webkitdirectory @change="onPickFiles" />
        <BaseButton v-if="canAdd()" type="primary" @click="pickFiles">
          {{ t('oss.selectFiles') }}
        </BaseButton>
        <BaseButton v-if="canAdd()" @click="pickFolder">
          {{ t('oss.selectFolder') }}
        </BaseButton>
        <BaseButton v-if="canAdd()" @click="createFolder">{{ t('oss.createFolder') }}</BaseButton>
        <BaseButton v-if="canAdd()" :disabled="!selected.length" @click="openMove()">{{ t('oss.move') }}</BaseButton>
        <BaseButton v-if="canDelete()" type="danger" :disabled="!selected.length" @click="deleteItems(selected)">
          {{ t('common.delete') }}
        </BaseButton>
        <input
          v-model="nameFilter"
          class="ml-auto h-32px px-8px border border-solid border-[var(--el-border-color)] rounded-4px"
          :placeholder="t('oss.filterName')"
        />
      </div>

      <OssUploadQueue v-if="config" :files="queueFiles" :config="config" @uploaded="loadList(false)" />

      <p v-if="truncated" class="mb-8px text-13px text-[var(--el-color-warning)]">
        {{ t('oss.truncatedHint') }}
        <BaseButton text type="primary" @click="loadList(true)">{{ t('oss.loadMore') }}</BaseButton>
      </p>

      <div
        class="min-h-360px rounded-6px"
        :class="dropActive ? 'outline outline-2 outline-[var(--el-color-primary)]' : ''"
        @dragover.prevent="dropActive = true"
        @dragleave="dropActive = false"
        @drop="onDrop"
      >
        <ElTable
          v-if="viewMode === 'list'"
          ref="tableRef"
          :data="items"
          :loading="loading"
          :row-key="rowKey"
          @selection-change="onTableSelection"
        >
          <ElTableColumn type="selection" width="48" />
          <ElTableColumn :label="t('oss.name')" min-width="240">
            <template #default="{ row }">
              <div
                class="flex items-center gap-8px cursor-pointer"
                @click="openItem(row as OssListItem)"
                @contextmenu="onContext($event, row as OssListItem)"
              >
                <Icon :icon="row.kind === 'folder' ? 'folder' : getFileIcon2(row.name.split('.').pop() || '').icon" />
                <span>{{ row.name }}</span>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="t('oss.size')" width="120">
            <template #default="{ row }">
              {{ row.kind === 'folder' ? '-' : formatFileSize(row.size) }}
            </template>
          </ElTableColumn>
          <ElTableColumn :label="t('oss.modified')" width="200">
            <template #default="{ row }">
              {{ row.kind === 'folder' || !row.lastModified ? '-' : formatToDateTime(row.lastModified) }}
            </template>
          </ElTableColumn>
        </ElTable>

        <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-12px p-8px" v-loading="loading">
          <div
            v-for="item in items"
            :key="rowKey(item)"
            class="border border-solid border-[var(--el-border-color)] rounded-8px p-10px cursor-pointer"
            @click="openItem(item)"
            @contextmenu="onContext($event, item)"
          >
            <div class="flex items-center justify-between mb-8px" @click.stop>
              <ElCheckbox :model-value="isSelected(item)" @change="(val) => toggleSelect(item, val === true)" />
            </div>
            <div class="flex flex-col items-center gap-8px">
              <Icon
                :icon="item.kind === 'folder' ? 'folder' : getFileIcon2(item.name.split('.').pop() || '').icon"
                :size="36"
              />
              <div class="text-center text-13px break-all line-clamp-2">{{ item.name }}</div>
            </div>
          </div>
          <ElEmpty v-if="!items.length" :description="t('oss.empty')" />
        </div>
      </div>
    </template>

    <div
      v-if="context.visible && context.item"
      class="fixed z-9999 bg-[var(--el-bg-color-overlay)] border border-solid border-[var(--el-border-color)] rounded-6px py-6px min-w-140px shadow"
      :style="{ left: `${context.x}px`, top: `${context.y}px` }"
      @click.stop
    >
      <button class="oss-menu-item" type="button" @click="openItem(context.item)">
        {{ context.item.kind === 'folder' ? t('oss.open') : t('oss.preview') }}
      </button>
      <button class="oss-menu-item" type="button" @click="downloadItem(context.item)">
        {{ context.item.kind === 'folder' ? t('oss.downloadZip') : t('oss.download') }}
      </button>
      <button
        v-if="context.item.kind === 'file'"
        class="oss-menu-item"
        type="button"
        @click="copyTempUrl(context.item)"
      >
        {{ t('oss.copyUrl') }}
      </button>
      <button
        v-if="canAdd() && selected.length <= 1"
        class="oss-menu-item"
        type="button"
        @click="renameItem(context.item)"
      >
        {{ t('oss.rename') }}
      </button>
      <button v-if="canAdd()" class="oss-menu-item" type="button" @click="openMove(context.item)">
        {{ t('oss.move') }}
      </button>
      <button
        v-if="canDelete()"
        class="oss-menu-item text-[var(--el-color-danger)]"
        type="button"
        @click="deleteItems([context.item])"
      >
        {{ t('common.delete') }}
      </button>
    </div>

    <OssMoveDialog v-model="moveOpen" :current-prefix="prefix" @confirm="confirmMove" />
  </ContentWrap>
</template>

<style scoped>
.oss-menu-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
}

.oss-menu-item:hover {
  background: var(--el-fill-color-light);
}
</style>
