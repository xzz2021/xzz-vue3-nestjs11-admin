import { Test, TestingModule } from "@nestjs/testing";
import { RedisHealthService } from "#/infrastructure/database/redis/redis-health.service";
import { PgService } from "#/infrastructure/database/prisma/pg.service";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PgService, useValue: { ping: vi.fn() } },
        { provide: RedisHealthService, useValue: { ping: vi.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe("Hello World!");
    });
  });
});
