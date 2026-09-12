export type OnlineStatus = "online" | "away";

export interface OnlineSession {
  jti: string;
  userId: string;
  username: string;
  phone: string;
  ip: string;
  location: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  loginAt: number;
  lastPingAt: number;
  exp: number;
  /** 超管会话不可被强制下线 */
  isSuperAdmin: boolean;
}

export interface OnlineUserItem extends OnlineSession {
  status: OnlineStatus;
  /** 是否当前操作者自身（列表侧展示用） */
  isSelf?: boolean;
  /** 是否允许强制下线 */
  kickable?: boolean;
}

export interface OnlineListResult {
  list: OnlineUserItem[];
  total: number;
  onlineCount: number;
  awayCount: number;
}

export interface UpsertOnlineInput {
  jti: string;
  userId: string;
  username: string;
  phone?: string;
  ip: string;
  location?: string;
  userAgent: string;
  exp: number;
  loginAt?: number;
  isSuperAdmin?: boolean;
}
