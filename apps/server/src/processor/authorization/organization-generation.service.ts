import { RedisAtomicService } from '#/infrastructure/database/redis/redis-atomic.service.js';
import { RedisKeys } from '#/processor/constants/cache.js';
import { Injectable } from '@nestjs/common';
import { OrganizationGenerationUnavailableException } from './authorization.errors.js';

//  组织部门授权快照缓存, 给缓存加版本号,后期读取时会进行核对
@Injectable()
export class OrganizationGenerationService {
  static readonly GENERATION_TTL_SECONDS = 7 * 24 * 60 * 60;
  static readonly MAX_ATTEMPTS = 3;
  static readonly RETRY_DELAY_MS = 10;

  constructor(private readonly atomic: RedisAtomicService) {}

  async currentGeneration(): Promise<number> {
    try {
      return await this.atomic.getCounter(RedisKeys.ORGANIZATION_GENERATION);
    } catch (error) {
      throw new OrganizationGenerationUnavailableException(error);
    }
  }

  async bump(): Promise<void> {
    let lastError: unknown;
    for (
      let attempt = 0;
      attempt < OrganizationGenerationService.MAX_ATTEMPTS;
      attempt++
    ) {
      try {
        await this.atomic.incrWithTtl(
          RedisKeys.ORGANIZATION_GENERATION,
          OrganizationGenerationService.GENERATION_TTL_SECONDS,
        );
        return;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < OrganizationGenerationService.MAX_ATTEMPTS) {
          await this.sleep(
            OrganizationGenerationService.RETRY_DELAY_MS * 2 ** attempt,
          );
        }
      }
    }
    throw new OrganizationGenerationUnavailableException(lastError);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
