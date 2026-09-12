/** Redis 滑动窗口：10s × 360 ≈ 最近 1 小时 */
export const MONITOR_METRICS_MAX = 360;
/** 系统异常日志最多保留条数 */
export const MONITOR_ERRORS_MAX = 50;
/** API 延迟样本环大小 */
export const MONITOR_LATENCY_SAMPLES = 100;

export const MONITOR_REDIS = {
  METRICS: "monitor:metrics",
  LATEST: "monitor:latest",
  ERRORS: "monitor:errors",
} as const;

export const MONITOR_CRON = "*/10 * * * * *";
