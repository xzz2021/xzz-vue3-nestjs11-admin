/** Redis 原子脚本。算法对齐 Redis 官方 rate limiter、pulkitxm/systems、nestjs-redisx locks。 */

/** Generation / epoch：INCR 后刷新 TTL，避免长期无写入时 key 过期。 */
export const INCR_WITH_TTL_SCRIPT = `
local value = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1])
return value
`;

/** 固定窗口计数：仅首次写入设置 TTL，避免每次 INCR 把窗口往后推。 */
export const INCR_IN_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

/** 固定窗口限流：INCRBY + 首次 PEXPIRE。返回 allowed, count, remaining, retryAfterMs。 */
export const FIXED_WINDOW_ALLOW_SCRIPT = `
local windowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local count = redis.call('INCRBY', KEYS[1], cost)
if count == cost then
  redis.call('PEXPIRE', KEYS[1], windowMs)
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then ttl = windowMs end
if count > limit then
  return {0, count, 0, ttl}
end
return {1, count, limit - count, ttl}
`;

/** 滑动窗口日志：ZSET 存时间戳，精确但内存随请求量增长。 */
export const SLIDING_WINDOW_LOG_SCRIPT = `
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - windowMs)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if oldest[2] then
    retryAfter = tonumber(oldest[2]) + windowMs - now
    if retryAfter < 0 then retryAfter = 0 end
  end
  redis.call('PEXPIRE', KEYS[1], windowMs)
  return {0, count, 0, retryAfter}
end
redis.call('ZADD', KEYS[1], now, member)
redis.call('PEXPIRE', KEYS[1], windowMs)
return {1, count + 1, limit - count - 1, 0}
`;

/** 滑动窗口计数：当前桶 + 上一桶加权，常数内存。KEYS[1]=当前窗，KEYS[2]=上一窗。 */
export const SLIDING_WINDOW_COUNTER_SCRIPT = `
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local elapsed = tonumber(ARGV[3])
local previousCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local currentCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local weight = (windowMs - elapsed) / windowMs
local estimated = math.floor(previousCount * weight) + currentCount
if estimated >= limit then
  return {0, estimated, 0, windowMs - elapsed}
end
local newCount = redis.call('INCR', KEYS[1])
if newCount == 1 then
  redis.call('PEXPIRE', KEYS[1], windowMs * 2)
end
return {1, estimated + 1, limit - estimated - 1, 0}
`;

/** Token bucket：HASH tokens + ts，按时间补令牌。 */
export const TOKEN_BUCKET_ALLOW_SCRIPT = `
local capacity = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now
end
local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * refillPerMs)
local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
local ttl = math.ceil(capacity / refillPerMs)
if ttl < 1 then ttl = 1 end
redis.call('PEXPIRE', KEYS[1], ttl)
return {allowed, tokens}
`;

/** 比较并删除：仅在值相等时删除。返回 1 成功，0 失败。 */
export const COMPARE_AND_DELETE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

/** 比较并设置过期：仅在值相等时设置过期。返回 1 成功，0 失败。 */
export const COMPARE_AND_PEXPIRE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`;
