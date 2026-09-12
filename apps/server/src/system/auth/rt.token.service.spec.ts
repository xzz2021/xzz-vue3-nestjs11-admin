import type { RedisService } from "@liaoliaots/nestjs-redis";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { RT_COOKIE_NAME } from "./http-cookie.js";
import { RtTokenService } from "./rt.token.service.js";

describe("RtTokenService", () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    eval: jest.fn().mockResolvedValue(1),
  };
  const jwt = {
    signAsync: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "ssoCount") return 2;
      if (key === "isProduction") return false;
      if (key === "token") {
        return {
          secret: "access-secret",
          refreshSecret: "refresh-secret",
          expiresTime: 300,
          refreshExpiresTime: 3600,
        };
      }
      return undefined;
    }),
  };

  const createService = () =>
    new RtTokenService(
      jwt as unknown as JwtService,
      { getOrThrow: () => redis } as unknown as RedisService,
      configService as unknown as ConfigService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue("OK");
    redis.del.mockResolvedValue(1);
    jwt.signAsync.mockImplementation(
      (_payload: unknown, options: { jwtid?: string }) =>
        Promise.resolve(`token:${options.jwtid ?? "none"}`),
    );
  });

  it("stores refresh expiry for jti and describes cookie maxAge from refresh TTL", async () => {
    const service = createService();
    const before = Math.floor(Date.now() / 1000);

    const issued = await service.issue("user-1", { username: "admin" });

    const jtiSetCall = redis.set.mock.calls.find(
      (call: unknown[]) =>
        typeof call[0] === "string" &&
        String(call[0]).startsWith("cookies:exp:"),
    );
    expect(jtiSetCall?.[2]).toBe("EX");
    expect(jtiSetCall?.[3]).toBe(3600);

    const storedExp = Number(jtiSetCall?.[1]);
    expect(storedExp).toBeGreaterThanOrEqual(before + 3600);
    expect(storedExp).toBeLessThanOrEqual(before + 3600 + 2);

    expect(issued.cookie).toEqual({
      action: "set",
      name: RT_COOKIE_NAME,
      value: issued.refreshToken,
      options: expect.objectContaining({
        httpOnly: true,
        maxAge: 3600 * 1000,
      }),
    });
  });

  it("rotates to a new jti and blacklists the old refresh token", async () => {
    const service = createService();
    redis.get.mockImplementation((key: string) => {
      if (key === "user:cookies:user-1")
        return Promise.resolve(JSON.stringify(["old-jti"]));
      if (key === "cookies:exp:old-jti")
        return Promise.resolve(String(Math.floor(Date.now() / 1000) + 1800));
      return Promise.resolve(null);
    });

    const result = await service.issue("user-1", {}, "old-jti");

    expect(result.jti).not.toBe("old-jti");
    expect(redis.set).toHaveBeenCalledWith(
      `rt:jwt:blacklist:old-jti`,
      "1",
      "EX",
      expect.any(Number),
    );
    expect(redis.del).toHaveBeenCalledWith("cookies:exp:old-jti");

    const listSetCall = redis.set.mock.calls.find(
      (call: unknown[]) => call[0] === "user:cookies:user-1",
    );
    expect(JSON.parse(String(listSetCall?.[1]))).toEqual([result.jti]);
  });

  it("blacklists with refresh TTL fallback when exp is missing or expired", async () => {
    const service = createService();
    await service.blacklistByJti("dead-jti", 0);
    expect(redis.set).toHaveBeenCalledWith(
      "rt:jwt:blacklist:dead-jti",
      "1",
      "EX",
      3600,
    );
  });

  it("describes a clear-cookie command without writing a response", () => {
    const command = createService().describeClearCookie();
    expect(command).toEqual({
      action: "clear",
      name: RT_COOKIE_NAME,
      options: expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      }),
    });
  });
});
