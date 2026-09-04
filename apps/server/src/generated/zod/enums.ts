export enum NoticeLevel {
  INFO = "INFO",
  SUCCESS = "SUCCESS",
  WARNING = "WARNING",
  ERROR = "ERROR"
}

export enum MenuType {
  DIRECTORY = "DIRECTORY",
  MENU = "MENU"
}

export enum PermissionType {
  BUTTON = "BUTTON",
  DATA = "DATA",
  API = "API",
  OTHER = "OTHER"
}

export enum MessageType {
  MAIL = "MAIL",
  SYSTEM = "SYSTEM",
  ALERT = "ALERT"
}

export enum BackupTrigger {
  MANUAL = "MANUAL",
  SCHEDULED = "SCHEDULED"
}

export enum BackupStatus {
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED"
}

export enum DataScope {
  ALL = "ALL",
  SELF = "SELF",
  DEPT = "DEPT",
  DEPT_TREE = "DEPT_TREE",
  CUSTOM_DEFINE = "CUSTOM_DEFINE"
}

export enum CustomerStatus {
  LEAD = "LEAD",
  FOLLOWING = "FOLLOWING",
  WON = "WON",
  FROZEN = "FROZEN"
}

export enum FileUploadStatus {
  INITIATED = "INITIATED",
  UPLOADING = "UPLOADING",
  COMPLETING = "COMPLETING",
  COMPLETED = "COMPLETED",
  ABORTED = "ABORTED",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED"
}
