<script setup lang="tsx">
import {
  cleanupDbBackupJobsApi,
  deleteDbBackupJobApi,
  downloadDbBackupJobApi,
  getDbBackupConfigApi,
  getDbBackupJobsApi,
  runDbBackupApi,
  updateDbBackupConfigApi
} from '@/api/dbBackup'
import type { BackupStatus, BackupTrigger, DbBackupConfig, DbBackupJob } from '@/api/dbBackup/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Table, type TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import router from '@/router'
import { formatToDateTime } from '@/utils/dateUtil'
import { formatBytes } from '@/utils/file'
import { getRoutePermissions } from '@/utils/route-permission'
import {
  ElCard,
  ElCol,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElRow,
  ElSelect,
  ElSwitch,
  ElTag
} from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

const { t } = useI18n()

const hasPermi = (code: string) => {
  return getRoutePermissions(router.currentRoute.value.meta).includes(code)
}

const configLoading = ref(false)
const saveLoading = ref(false)
const runLoading = ref(false)
const cleanupLoading = ref(false)
const jobsLoading = ref(false)

const configForm = reactive<DbBackupConfig>({
  id: 'default',
  enabled: true,
  cron: '0 0 * * * *',
  timezone: 'Asia/Shanghai',
  retentionMax: 24,
  filePrefix: 'backstage_db',
  gzip: true,
  lastRunAt: null,
  lastStatus: null,
  lastError: null,
  nextRunAt: null,
  createdAt: '',
  updatedAt: ''
})

const jobs = ref<DbBackupJob[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const statusFilter = ref<BackupStatus | ''>('')
const triggerFilter = ref<BackupTrigger | ''>('')

const statusOptions: Array<{ label: string; value: BackupStatus }> = [
  { label: 'RUNNING', value: 'RUNNING' },
  { label: 'SUCCESS', value: 'SUCCESS' },
  { label: 'FAILED', value: 'FAILED' },
  { label: 'EXPIRED', value: 'EXPIRED' }
]

const triggerOptions: Array<{ label: string; value: BackupTrigger }> = [
  { label: t('dbBackup.manual'), value: 'MANUAL' },
  { label: t('dbBackup.scheduled'), value: 'SCHEDULED' }
]

const nextRunLabel = computed(() =>
  configForm.enabled && configForm.nextRunAt ? formatToDateTime(configForm.nextRunAt) : '-'
)

const lastRunLabel = computed(() => (configForm.lastRunAt ? formatToDateTime(configForm.lastRunAt) : '-'))

const statusLabel = (status?: BackupStatus | null) => {
  if (status === 'RUNNING') return t('dbBackup.running')
  if (status === 'SUCCESS') return t('dbBackup.success')
  if (status === 'FAILED') return t('dbBackup.failed')
  if (status === 'EXPIRED') return t('dbBackup.expired')
  return '-'
}

const statusTag = (status?: BackupStatus | null) => {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'warning'
  return 'info'
}

const triggerLabel = (trigger: BackupTrigger) => (trigger === 'MANUAL' ? t('dbBackup.manual') : t('dbBackup.scheduled'))

const fetchConfig = async () => {
  configLoading.value = true
  try {
    const res = await getDbBackupConfigApi()
    Object.assign(configForm, res.data)
  } finally {
    configLoading.value = false
  }
}

const fetchJobs = async () => {
  jobsLoading.value = true
  try {
    const res = await getDbBackupJobsApi({
      pageIndex: currentPage.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
      trigger: triggerFilter.value || undefined
    })
    jobs.value = res.data?.list ?? []
    total.value = res.data?.total ?? 0
  } finally {
    jobsLoading.value = false
  }
}

const saveConfig = async () => {
  saveLoading.value = true
  try {
    const res = await updateDbBackupConfigApi({
      enabled: configForm.enabled,
      cron: configForm.cron,
      timezone: configForm.timezone,
      retentionMax: configForm.retentionMax,
      filePrefix: configForm.filePrefix,
      gzip: configForm.gzip
    })
    Object.assign(configForm, res.data)
    ElMessage.success(res.message || t('dbBackup.saveSuccess'))
  } finally {
    saveLoading.value = false
  }
}

const handleRun = async () => {
  try {
    await ElMessageBox.confirm(t('dbBackup.runConfirm'), t('common.reminder'), { type: 'warning' })
  } catch {
    return
  }
  runLoading.value = true
  try {
    const res = await runDbBackupApi()
    ElMessage.success(res.message || t('dbBackup.runSuccess'))
    await Promise.all([fetchConfig(), fetchJobs()])
  } finally {
    runLoading.value = false
  }
}

const handleCleanup = async () => {
  try {
    await ElMessageBox.confirm(t('dbBackup.cleanupConfirm'), t('common.reminder'), {
      type: 'warning'
    })
  } catch {
    return
  }
  cleanupLoading.value = true
  try {
    const res = await cleanupDbBackupJobsApi()
    ElMessage.success(res.message || t('dbBackup.cleanupSuccess'))
    await fetchJobs()
  } finally {
    cleanupLoading.value = false
  }
}

const handleDelete = async (row: DbBackupJob) => {
  try {
    await ElMessageBox.confirm(t('dbBackup.deleteConfirm', { name: row.fileName }), t('common.reminder'), {
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await deleteDbBackupJobApi(row.id)
  ElMessage.success(res.message || t('dbBackup.deleteSuccess'))
  await fetchJobs()
}

const handleDownload = async (row: DbBackupJob) => {
  try {
    const response = await downloadDbBackupJobApi(row.id)
    const fileName = parseFileName(response.headers['content-disposition']) || row.fileName
    const objectUrl = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  } catch {
    ElMessage.error(t('dbBackup.downloadFailed'))
  }
}

const refreshJobs = async () => {
  currentPage.value = 1
  await fetchJobs()
}

const tableColumns = reactive<TableColumn[]>([
  { field: 'index', type: 'index', label: t('userDemo.index') },
  {
    field: 'trigger',
    label: t('dbBackup.trigger'),
    width: 110,
    formatter: (row: DbBackupJob) => triggerLabel(row.trigger)
  },
  {
    field: 'status',
    label: t('menu.status'),
    width: 110,
    slots: {
      default: (data: any) => {
        const row = data.row as DbBackupJob
        return <ElTag type={statusTag(row.status)}>{statusLabel(row.status)}</ElTag>
      }
    }
  },
  {
    field: 'fileName',
    label: t('dbBackup.fileName'),
    minWidth: 220
  },
  {
    field: 'fileSize',
    label: t('file.size'),
    width: 120,
    formatter: (row: DbBackupJob) => (row.fileSize ? formatBytes(Number(row.fileSize)) : '-')
  },
  {
    field: 'durationMs',
    label: t('dbBackup.durationMs'),
    width: 110,
    formatter: (row: DbBackupJob) => (row.durationMs != null ? `${row.durationMs} ms` : '-')
  },
  {
    field: 'createdBy',
    label: t('dbBackup.operator'),
    width: 120,
    formatter: (row: DbBackupJob) => row.createdBy?.username || '-'
  },
  {
    field: 'startedAt',
    label: t('dbBackup.startedAt'),
    minWidth: 168,
    formatter: (row: DbBackupJob) => formatToDateTime(row.startedAt)
  },
  {
    field: 'finishedAt',
    label: t('dbBackup.finishedAt'),
    minWidth: 168,
    formatter: (row: DbBackupJob) => (row.finishedAt ? formatToDateTime(row.finishedAt) : '-')
  },
  {
    field: 'checksum',
    label: 'SHA-256',
    minWidth: 220
  },
  {
    field: 'errorMessage',
    label: t('monitor.message'),
    minWidth: 220
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    minWidth: 180,
    fixed: 'right',
    slots: {
      default: (data: any) => {
        const row = data.row as DbBackupJob
        return (
          <>
            {hasPermi('databaseBackup:download') ? (
              <BaseButton disabled={row.status !== 'SUCCESS'} type="primary" onClick={() => handleDownload(row)}>
                {t('formDemo.download')}
              </BaseButton>
            ) : undefined}
            {hasPermi('databaseBackup:delete') ? (
              <BaseButton type="danger" onClick={() => handleDelete(row)}>
                {t('exampleDemo.del')}
              </BaseButton>
            ) : undefined}
          </>
        )
      }
    }
  }
])

onMounted(async () => {
  await Promise.all([fetchConfig(), fetchJobs()])
})

const parseFileName = (contentDisposition?: string) => {
  if (!contentDisposition) return ''
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])
  const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return asciiMatch?.[1] ? decodeURIComponent(asciiMatch[1]) : ''
}
</script>

<template>
  <ContentWrap>
    <ElRow :gutter="12" class="mb-12px">
      <ElCol :xs="24" :lg="10">
        <ElCard v-loading="configLoading" :header="t('dbBackup.configTitle')" shadow="never">
          <ElForm label-width="120px">
            <ElFormItem :label="t('dbBackup.enabled')">
              <ElSwitch v-model="configForm.enabled" />
            </ElFormItem>
            <ElFormItem :label="t('dbBackup.cron')">
              <ElInput v-model="configForm.cron" />
            </ElFormItem>
            <ElFormItem :label="t('dbBackup.timezone')">
              <ElInput v-model="configForm.timezone" />
            </ElFormItem>
            <ElFormItem :label="t('dbBackup.filePrefix')">
              <ElInput v-model="configForm.filePrefix" />
            </ElFormItem>
            <ElFormItem :label="t('dbBackup.retentionMax')">
              <ElInputNumber v-model="configForm.retentionMax" :min="1" :max="999" />
            </ElFormItem>
            <ElFormItem :label="t('dbBackup.gzip')">
              <ElSwitch v-model="configForm.gzip" />
            </ElFormItem>
            <ElFormItem>
              <div class="text-12px text-[var(--el-text-color-secondary)]">
                {{ t('dbBackup.cronTip') }}
              </div>
            </ElFormItem>
            <ElFormItem>
              <BaseButton
                v-if="hasPermi('databaseBackup:update')"
                :loading="saveLoading"
                type="primary"
                @click="saveConfig"
              >
                {{ t('exampleDemo.save') }}
              </BaseButton>
              <BaseButton v-if="hasPermi('databaseBackup:run')" :loading="runLoading" type="warning" @click="handleRun">
                {{ t('dbBackup.runNow') }}
              </BaseButton>
              <BaseButton
                v-if="hasPermi('databaseBackup:delete')"
                :loading="cleanupLoading"
                type="danger"
                @click="handleCleanup"
              >
                {{ t('dbBackup.cleanup') }}
              </BaseButton>
            </ElFormItem>
          </ElForm>
        </ElCard>
      </ElCol>
      <ElCol :xs="24" :lg="14">
        <ElCard :header="t('dbBackup.summaryTitle')" shadow="never">
          <div class="leading-30px text-14px">
            <div>{{ t('dbBackup.nextRunAt') }}：{{ nextRunLabel }}</div>
            <div>{{ t('dbBackup.lastRunAt') }}：{{ lastRunLabel }}</div>
            <div>
              {{ t('dbBackup.lastStatus') }}：
              <ElTag :type="statusTag(configForm.lastStatus)" size="small">
                {{ statusLabel(configForm.lastStatus) }}
              </ElTag>
            </div>
            <div>{{ t('dbBackup.lastError') }}：{{ configForm.lastError || '-' }}</div>
          </div>
        </ElCard>
      </ElCol>
    </ElRow>

    <ElCard shadow="never">
      <div class="mb-12px flex flex-wrap items-center gap-12px">
        <ElSelect v-model="statusFilter" clearable :placeholder="t('dbBackup.statusPlaceholder')" style="width: 180px">
          <ElOption
            v-for="item in statusOptions"
            :key="item.value"
            :label="statusLabel(item.value)"
            :value="item.value"
          />
        </ElSelect>
        <ElSelect
          v-model="triggerFilter"
          clearable
          :placeholder="t('dbBackup.triggerPlaceholder')"
          style="width: 180px"
        >
          <ElOption v-for="item in triggerOptions" :key="item.value" :label="item.label" :value="item.value" />
        </ElSelect>
        <BaseButton type="primary" @click="refreshJobs">
          {{ t('common.query') }}
        </BaseButton>
      </div>

      <Table
        v-model:currentPage="currentPage"
        v-model:pageSize="pageSize"
        align="center"
        headerAlign="center"
        :columns="tableColumns"
        :data="jobs"
        :loading="jobsLoading"
        :pagination="{ total }"
        @update:current-page="fetchJobs"
        @update:page-size="fetchJobs"
      />
    </ElCard>
  </ContentWrap>
</template>
