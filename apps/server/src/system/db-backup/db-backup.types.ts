import type {
  BackupStatus,
  BackupTrigger,
  DbBackupConfig,
  DbBackupJob,
} from "#/generated/prisma/client.js";

export interface BackupRuntimeConfig {
  dir: string;
  enabled: boolean;
  cron: string;
  timezone: string;
  retentionMax: number;
  filePrefix: string;
  gzip: boolean;
}

export type BackupConfigFields = Omit<BackupRuntimeConfig, "dir">;

export interface BackupExecutionResult {
  fileName: string;
  filePath: string;
  fileSize: bigint;
  checksum: string;
  startedAt: Date;
  finishedAt: Date;
}

export interface BackupJobListItem extends DbBackupJob {
  createdBy?: {
    id: string;
    username: string;
  } | null;
}

export interface BackupConfigPayload extends DbBackupConfig {
  nextRunAt: string | null;
  message: string;
}

export interface BackupJobQuery {
  pageIndex: number;
  pageSize: number;
  status?: BackupStatus;
  trigger?: BackupTrigger;
}

export interface DbBackupQueueJob {
  dbJobId: string;
  trigger: BackupTrigger;
}
