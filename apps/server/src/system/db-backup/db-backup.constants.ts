export const DB_BACKUP_CONFIG_ID = "default";
export const DB_BACKUP_QUEUE = "db-backup";
export const DB_BACKUP_JOB_RUN = "run";
export const DB_BACKUP_JOB_SCHEDULED = "scheduled";
/** 立即备份在队列中的幂等 jobId：同一时刻只允许一个待执行/执行中的手动任务。BullMQ 禁止 jobId 含 ':' */
export const DB_BACKUP_MANUAL_JOB_ID = "db-backup-manual";
/** 定时备份 Job Scheduler 的稳定 ID，upsert 时不会重复创建 */
export const DB_BACKUP_SCHEDULED_SCHEDULER_ID = "db-backup-scheduled";
/** 历史版本用过的调度 ID，启动时清理，避免与新 ID 同时触发 */
export const DB_BACKUP_LEGACY_SCHEDULER_IDS = ["db-backup:scheduled"];
export const DB_BACKUP_LOCK_KEY = "db-backup:lock";
export const DB_BACKUP_LOCK_TTL_MS = 30 * 60 * 1000;
/** 仅当锁持有者 token 匹配时删除，避免误释别人的锁 */
export const DB_BACKUP_RELEASE_LOCK_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
export const DB_BACKUP_DEFAULT_CRON = "0 0 * * * *";
export const DB_BACKUP_DEFAULT_RETENTION_MAX = 24;
export const DB_BACKUP_DEFAULT_TIMEZONE = "Asia/Shanghai";
export const DB_BACKUP_DEFAULT_PREFIX = "backstage_db";
export const DB_BACKUP_DEFAULT_GZIP = true;
export const DB_BACKUP_MAX_PAGE_SIZE = 100;
export const DB_BACKUP_ALERT_KEY = "db-backup-failed";
export const DB_BACKUP_ALERT_DEBOUNCE_SEC = 600;
