export const MESSAGE_QUEUE = "message-dispatch";
export const MESSAGE_JOB = "dispatch";
/** Redis Pub/Sub：落库后广播给本机 WS Gateway */
export const MESSAGE_PUSH_CHANNEL = "message:push";
/** 未读数缓存 */
export const MESSAGE_UNREAD_PREFIX = "message:unread:";
export const MESSAGE_UNREAD_TTL_SEC = 3600;
export const MESSAGE_ALERT_DEBOUNCE_PREFIX = "message:alert:debounce:";
