export type BackupStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'
export type BackupTrigger = 'MANUAL' | 'SCHEDULED'

export interface DbBackupConfig {
  id: string
  enabled: boolean
  cron: string
  timezone: string
  retentionMax: number
  filePrefix: string
  gzip: boolean
  lastRunAt?: string | null
  lastStatus?: BackupStatus | null
  lastError?: string | null
  nextRunAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface DbBackupJob {
  id: string
  trigger: BackupTrigger
  status: BackupStatus
  fileName: string
  filePath: string
  fileSize?: string | null
  checksum?: string | null
  startedAt: string
  finishedAt?: string | null
  durationMs?: number | null
  errorMessage?: string | null
  createdById?: string | null
  createdBy?: {
    id: string
    username: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface DbBackupJobListResponse {
  list: DbBackupJob[]
  total: number
  pageIndex: number
  pageSize: number
}

export interface DbBackupJobQuery {
  pageIndex?: number
  pageSize?: number
  status?: BackupStatus
  trigger?: BackupTrigger
}

export interface UpdateDbBackupConfigDto {
  enabled: boolean
  cron: string
  timezone: string
  retentionMax: number
  filePrefix: string
  gzip: boolean
}
