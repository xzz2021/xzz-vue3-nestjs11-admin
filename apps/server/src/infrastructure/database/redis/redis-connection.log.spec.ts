import { Logger } from "@nestjs/common";
import { createQuietRedis } from "./redis-connection.log.js";

describe("createQuietRedis", () => {
  it("swallows ioredis unhandled dumps and logs a one-line failure", async () => {
    const consoleErrors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      consoleErrors.push(args.map(String).join(" "));
    });
    const logger = {
      error: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
    } as unknown as Logger;

    const client = createQuietRedis(
      {
        host: "127.0.0.1",
        port: 1,
        family: 4,
        lazyConnect: false,
        retryStrategy: () => null,
        connectTimeout: 200,
      },
      logger,
      "127.0.0.1:1",
    );

    await new Promise((resolve) => setTimeout(resolve, 300));
    client.disconnect();
    spy.mockRestore();

    expect(
      consoleErrors.some((line) => line.includes("Unhandled error")),
    ).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Redis 未启动，无法连接 127.0.0.1:1"),
    );
  });
});
