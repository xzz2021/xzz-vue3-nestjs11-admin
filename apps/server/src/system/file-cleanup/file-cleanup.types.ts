export type FileCleanupJob =
  | { kind: "managed-file"; fileId: number; path: string }
  | { kind: "backup-job"; backupJobId: string; path: string }
  | { kind: "orphan-path"; path: string }
  | { kind: "upload-session"; sessionId: string; path: string };
