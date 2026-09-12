import { Global, Module } from '@nestjs/common';
import { REDIS_MODULE } from './cache-ioredis.js';
import { RedisAtomicService } from './redis-atomic.service.js';
import { RedisHealthService } from './redis-health.service.js';

@Global()
@Module({
  imports: [REDIS_MODULE],
  providers: [RedisHealthService, RedisAtomicService],
  exports: [REDIS_MODULE, RedisHealthService, RedisAtomicService],
})
export class AppRedisModule {}
