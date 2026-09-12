/** 无 ping 超过该时间视为离开 */
export const ONLINE_AWAY_MS = 45_000;
/** presence key TTL，ping 时刷新 */
export const ONLINE_PRESENCE_TTL_SEC = 120;
/** 前端建议 ping 间隔 */
export const ONLINE_PING_INTERVAL_MS = 15_000;

export const ONLINE_REDIS = {
  /** online:session:{jti} */
  SESSION: "online:session:",
  /** SET of jti */
  INDEX: "online:index",
} as const;
