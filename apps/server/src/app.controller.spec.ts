import { Test, TestingModule } from "@nestjs/testing";
import { RedisHealthService } from "#/infrastructure/database/redis/redis-health.service.js";
import { PgService } from "#/infrastructure/database/prisma/pg.service.js";
import { IS_PUBLIC_KEY, SKIP_WRAP_KEY } from "#/processor/decorator/index.js";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

describe("AppController", () => {
  let appController: AppController;
  const pingPostgres = vi.fn();
  const pingRedis = vi.fn();

  beforeEach(async () => {
    pingPostgres.mockReset();
    pingRedis.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PgService, useValue: { ping: pingPostgres } },
        { provide: RedisHealthService, useValue: { ping: pingRedis } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe("Hello World!");
    });
  });

  describe("health", () => {
    it("exposes GET /health without authentication", () => {
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, AppController.prototype.health),
      ).toBe(true);
    });

    it("skips response wrapping so probes can read HTTP 503", () => {
      expect(
        Reflect.getMetadata(SKIP_WRAP_KEY, AppController.prototype.health),
      ).toBe(true);
    });

    it("returns 200 when postgres and redis are up", async () => {
      pingPostgres.mockResolvedValue(true);
      pingRedis.mockResolvedValue(true);
      const res = { status: vi.fn() };

      const body = await appController.health(res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(body).toEqual({
        status: "ok",
        redis: "up",
        database: "up",
      });
    });

    it("returns 503 when redis is down", async () => {
      pingPostgres.mockResolvedValue(true);
      pingRedis.mockResolvedValue(false);
      const res = { status: vi.fn() };

      const body = await appController.health(res as never);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(body).toEqual({
        status: "degraded",
        redis: "down",
        database: "up",
      });
    });

    it("returns 503 when postgres is down", async () => {
      pingPostgres.mockResolvedValue(false);
      pingRedis.mockResolvedValue(true);
      const res = { status: vi.fn() };

      const body = await appController.health(res as never);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(body).toEqual({
        status: "degraded",
        redis: "up",
        database: "down",
      });
    });
  });
});
