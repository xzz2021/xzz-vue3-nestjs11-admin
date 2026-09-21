import { RedisHealthService } from "#/infrastructure/database/redis/redis-health.service.js";
import { PgService } from "#/infrastructure/database/prisma/pg.service.js";
import { Injectable } from "@nestjs/common";

export type HealthStatus = "ok" | "degraded";
export type DependencyStatus = "up" | "down";

export interface HealthSnapshot {
  status: HealthStatus;
  redis: DependencyStatus;
  database: DependencyStatus;
}

@Injectable()
export class AppService {
  constructor(
    private readonly pgService: PgService,
    private readonly redisHealthService: RedisHealthService,
  ) {}

  getHello(): string {
    return "Hello World!";
  }

  async checkHealth(): Promise<HealthSnapshot> {
    const [redisOk, databaseOk] = await Promise.all([
      this.redisHealthService.ping(),
      this.pgService.ping(),
    ]);
    const ok = redisOk && databaseOk;
    return {
      status: ok ? "ok" : "degraded",
      redis: redisOk ? "up" : "down",
      database: databaseOk ? "up" : "down",
    };
  }
}
