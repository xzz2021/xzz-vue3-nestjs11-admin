import type { RedisService } from "@liaoliaots/nestjs-redis";
import { RbacPermissionCacheService } from "./rbac-permission-cache.service";

describe("RbacPermissionCacheService", () => {
  const redis = {
    get: jest.fn(),
    mget: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    eval: jest.fn(),
  };

  const createService = () =>
    new RbacPermissionCacheService({
      getOrThrow: () => redis,
    } as unknown as RedisService);

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.mget.mockResolvedValue([null, null]);
    redis.set.mockResolvedValue("OK");
    redis.del.mockResolvedValue(1);
    redis.eval.mockResolvedValue(1);
  });

  it("reads wrapped cache when generation matches", async () => {
    const service = createService();
    redis.mget.mockResolvedValue([
      JSON.stringify({ v: 0, p: ["user:update"] }),
      null,
    ]);

    await expect(service.get("user-1")).resolves.toEqual(["user:update"]);
  });

  it("exposes the current user permission generation", async () => {
    const service = createService();
    redis.get.mockResolvedValue("3");

    await expect(service.currentGeneration("user-1")).resolves.toBe(3);
  });

  it("treats leftover cache as miss when generation was bumped", async () => {
    const service = createService();
    redis.mget.mockResolvedValue([
      JSON.stringify({ v: 0, p: ["user:update"] }),
      "1",
    ]);

    await expect(service.get("user-1")).resolves.toBeNull();
  });

  it("writes permission cache with generation and jittered ttl", async () => {
    const service = createService();
    redis.get.mockResolvedValue("2");

    await service.set("user-1", ["user:update"]);

    expect(redis.set).toHaveBeenCalledWith(
      "rbac:permissions:user-1",
      JSON.stringify({ v: 2, p: ["user:update"] }),
      "EX",
      expect.any(Number),
    );
    const ttl = redis.set.mock.calls[0][3] as number;
    expect(ttl).toBeGreaterThanOrEqual(300);
    expect(ttl).toBeLessThanOrEqual(360);
  });

  it("caches empty permissions as negative cache", async () => {
    const service = createService();
    redis.mget.mockResolvedValue([JSON.stringify({ v: 0, p: [] }), "0"]);

    await expect(service.get("user-1")).resolves.toEqual([]);
  });

  it("atomically bumps generation, refreshes ttl, and deletes the old cache for each user", async () => {
    const service = createService();

    await service.invalidateUsers(["user-1", "user-1", "user-2"]);

    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      2,
      "rbac:perm-gen:user-1",
      "rbac:permissions:user-1",
      String(RbacPermissionCacheService.GEN_TTL_SECONDS),
    );
    expect(redis.eval.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("redis.call('EXPIRE', KEYS[1], ARGV[1])"),
    );
    expect(redis.eval.mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("redis.call('DEL', KEYS[2])"),
    );
  });

  it("throws a typed 503 after atomic invalidation retries are exhausted", async () => {
    const service = createService();
    redis.eval.mockRejectedValue(new Error("redis down"));

    await expect(service.invalidateUsers(["user-1"])).rejects.toMatchObject({
      status: 503,
      message: "授权缓存暂不可用，请稍后重试",
    });
    expect(redis.eval).toHaveBeenCalledTimes(3);
  });

  it("retries transient invalidate failures and succeeds", async () => {
    const service = createService();
    redis.eval
      .mockRejectedValueOnce(new Error("redis down"))
      .mockResolvedValueOnce(1);

    await expect(service.invalidateUsers(["user-1"])).resolves.toBeUndefined();
    expect(redis.eval).toHaveBeenCalledTimes(2);
  });

  it("retries only the failed user when a multi-user invalidation partially fails", async () => {
    const service = createService();
    const attempts = new Map<string, number>();
    redis.eval.mockImplementation(
      (_script, _numberOfKeys, generationKey: string) => {
        const attempt = (attempts.get(generationKey) ?? 0) + 1;
        attempts.set(generationKey, attempt);
        if (generationKey.endsWith("user-2") && attempt === 1)
          return Promise.reject(new Error("transient"));
        return Promise.resolve(1);
      },
    );

    await service.invalidateUsers(["user-1", "user-2"]);

    expect(attempts.get("rbac:perm-gen:user-1")).toBe(1);
    expect(attempts.get("rbac:perm-gen:user-2")).toBe(2);
  });

  it("singleflight coalesces concurrent cache fills", async () => {
    const service = createService();
    let calls = 0;
    const loader = jest.fn(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return ["user:update"];
    });

    const [a, b] = await Promise.all([
      service.getOrLoad("user-1", loader),
      service.getOrLoad("user-1", loader),
    ]);

    expect(a).toEqual(["user:update"]);
    expect(b).toEqual(["user:update"]);
    expect(calls).toBe(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
