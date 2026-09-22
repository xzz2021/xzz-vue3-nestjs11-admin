import { hashPayPassword } from "#/processor/utils/index.js";
import type { UserRepository } from "#/system/user/user.repository.js";
import { RedisService } from "@liaoliaots/nestjs-redis";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service.js";
import type { LockoutService } from "./lockout.service.js";
import type { RtTokenService } from "./rt.token.service.js";
import type { SessionRevocationService } from "./session-revocation.service.js";
import type { TokenService } from "./token.service.js";

vi.mock("#/processor/utils/index.js", () => ({
  hashPayPassword: vi.fn(() => Promise.resolve("hashed-new")),
  verifyPayPassword: vi.fn(),
}));

describe("AuthService SMS / forgot password", () => {
  const phone = "13800138000";
  const redisGet = vi.fn();
  const redisSet = vi.fn();
  const redisDel = vi.fn();
  const findIdByPhone = vi.fn();
  const findByPhone = vi.fn();
  const updateById = vi.fn();
  const revokeAll = vi.fn();
  const onSuccess = vi.fn();
  const record = vi.fn();

  const createService = () =>
    new AuthService(
      {
        findIdByPhone,
        findByPhone,
        updateById,
      } as unknown as UserRepository,
      {} as JwtService,
      {
        getOrThrow: () => ({
          get: redisGet,
          set: redisSet,
          del: redisDel,
        }),
      } as unknown as RedisService,
      { get: () => ({}) } as unknown as ConfigService,
      {} as TokenService,
      {} as RtTokenService,
      { revokeAll } as unknown as SessionRevocationService,
      {
        ensureNotLocked: vi.fn(),
        onFail: vi.fn(),
        onSuccess,
      } as unknown as LockoutService,
      {
        record,
      } as unknown as import("#/core/logger/audit-log.service.js").AuditLogService,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    redisGet.mockResolvedValue(null);
    redisSet.mockResolvedValue("OK");
    redisDel.mockResolvedValue(1);
    findIdByPhone.mockResolvedValue({ id: "user-1" });
    findByPhone.mockResolvedValue({
      id: "user-1",
      phone,
      enabled: true,
    });
    updateById.mockResolvedValue({ id: "user-1" });
    revokeAll.mockResolvedValue(undefined);
    onSuccess.mockResolvedValue(undefined);
    record.mockResolvedValue(undefined);
  });

  it("stores a demo SMS code for reset and includes it in the message", async () => {
    const result = await createService().getSmsCode(phone, "reset");

    expect(result.message).toMatch(/演示模式/);
    expect(result.message).toMatch(/\d{6}/);
    expect(redisSet).toHaveBeenCalledWith(
      `reset_${phone}`,
      expect.stringMatching(/^\d{6}$/),
      "EX",
      300,
    );
    expect(redisSet).toHaveBeenCalledWith(
      `sms_cd_reset_${phone}`,
      "1",
      "EX",
      60,
    );
  });

  it("rejects SMS requests within the cooldown window", async () => {
    redisGet.mockResolvedValue("1");

    await expect(createService().getSmsCode(phone, "reset")).rejects.toThrow(
      /60秒/,
    );
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("does not reveal missing users when requesting reset codes", async () => {
    findIdByPhone.mockResolvedValue(null);

    const result = await createService().getSmsCode(phone, "reset");

    expect(result.message).toMatch(/演示模式/);
    expect(redisSet).toHaveBeenCalledWith(
      `sms_cd_reset_${phone}`,
      "1",
      "EX",
      60,
    );
    expect(redisSet).not.toHaveBeenCalledWith(
      `reset_${phone}`,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("rejects register SMS when the phone already exists", async () => {
    await expect(
      createService().getSmsCode(phone, "register"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("resets password after a valid code and revokes sessions", async () => {
    redisGet.mockResolvedValue("123456");

    const result = await createService().forgotPassword(
      { phone, code: "123456", password: "ChangeMe_Now!" },
      "127.0.0.1",
    );

    expect(result.message).toMatch(/重置成功/);
    expect(hashPayPassword).toHaveBeenCalledWith("ChangeMe_Now!");
    expect(updateById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        password: "hashed-new",
        passwordChangedAt: expect.any(Date),
      }),
    );
    expect(revokeAll).toHaveBeenCalledWith("user-1");
    expect(onSuccess).toHaveBeenCalledWith(phone);
    expect(redisDel).toHaveBeenCalledWith(`reset_${phone}`);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.forgot_password",
        resourceId: "user-1",
      }),
    );
  });

  it("rejects invalid or missing codes with a uniform message", async () => {
    redisGet.mockResolvedValue("654321");

    await expect(
      createService().forgotPassword({
        phone,
        code: "123456",
        password: "ChangeMe_Now!",
      }),
    ).rejects.toThrow(/验证码错误或已过期/);
    expect(updateById).not.toHaveBeenCalled();
  });

  it("rejects disabled users with the same code error", async () => {
    redisGet.mockResolvedValue("123456");
    findByPhone.mockResolvedValue({ id: "user-1", phone, enabled: false });

    await expect(
      createService().forgotPassword({
        phone,
        code: "123456",
        password: "ChangeMe_Now!",
      }),
    ).rejects.toThrow(/验证码错误或已过期/);
    expect(updateById).not.toHaveBeenCalled();
  });
});
