import { NoticeLevel } from '@/generated/prisma/client.js';
import { MessageType } from '@/generated/prisma/client.js';

export type { MessageType };
export { NoticeLevel };

export interface MessageDispatchJob {
  /** 入队时生成，落库幂等键 */
  dispatchId: string;
  type: MessageType;
  title: string;
  content: string;
  level?: NoticeLevel;
  senderId?: string | null;
  /** MAIL：指定接收人；SYSTEM/ALERT 可省略，由处理器解析 */
  receiverIds?: string[];
  meta?: Record<string, unknown> | null;
}

export interface MessagePushPayload {
  userId: string;
  unread: number;
  items: MessagePushItem[];
}

export interface MessagePushItem {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  level: NoticeLevel;
  createdAt: string;
  senderId?: string | null;
  senderName?: string | null;
}

export interface MessageListItem {
  id: string;
  type: MessageType;
  title: string;
  content: string;
  level: NoticeLevel;
  readAt: Date | null;
  createdAt: Date;
  senderId: string | null;
  sender?: { id: string; username: string } | null;
  meta: unknown;
}
