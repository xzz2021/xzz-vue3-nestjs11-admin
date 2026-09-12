import { verifyPayPassword } from "@/processor/utils/index.js";
import type { UserRepository } from "@/system/user/user.repository.js";
import { RedisService } from "@liaoliaots/nestjs-redis";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service.js";
import type { LockoutService } from "./lockout.service.js";
import type { RtTokenService } from "./rt.token.service.js";
import type { SessionRevocationService } from "./session-revocation.service.js";
import type { TokenService } from "./token.service.js";

jest.mock("@/processor/utils", () => ({
  hashPayPassword: jest.fn(),
  verifyPayPassword: jest.fn(),
}));

describe("AuthService rtLogin lockout", () => {
  const phone = "13800138000";
  const password = "secret";
  const ip = "127.0.0.1";
  const loginInfo = { phone, password };
  const user = {
    id: "user-1",
    username: "admin",
    phone,
    password: "hashed",
    roles: [{ role: { name: "管理员", code: "ADMIN" } }],
    avatar: null,
    email: null,
  };

  const findEnabledByPhoneForLogin = jest.fn();
  const recordLoginSuccess = jest.fn();
  const ensureNotLocked = jest.fn();
  const onFail = jest.fn();
  const onSuccess = jest.fn();
  const signToken = jest.fn();

  const record = jest.fn();
  const createService = () =>
    new AuthService(
      {
        findEnabledByPhoneForLogin,
        recordLoginSuccess,
      } as unknown as UserRepository,
      {} as JwtService,
      { getOrThrow: () => ({ del: jest.fn() }) } as unknown as RedisService,
      { get: () => ({}) } as unknown as ConfigService,
      {} as TokenService,
      { signToken } as unknown as RtTokenService,
      {} as SessionRevocationService,
      { ensureNotLocked, onFail, onSuccess } as unknown as LockoutService,
      {
        record,
      } as unknown as import("@/core/logger/audit-log.service.js").AuditLogService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    ensureNotLocked.mockResolvedValue(undefined);
    onFail.mockResolvedValue(undefined);
    onSuccess.mockResolvedValue(undefined);
    recordLoginSuccess.mockResolvedValue({ id: user.id });
    signToken.mockResolvedValue({
      accessToken: "access",
      cookie: { action: "set", name: "rt", value: "refresh", options: {} },
    });
    record.mockResolvedValue(undefined);
    (verifyPayPassword as jest.Mock).mockResolvedValue(true);
  });

  it("blocks login before credential lookup when the account is locked", async () => {
    ensureNotLocked.mockRejectedValue(
      new ForbiddenException("账号已锁定，请12秒后再试"),
    );

    await expect(createService().rtLogin(loginInfo, ip)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findEnabledByPhoneForLogin).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.lockout", success: false }),
    );
  });

  it("records a failure for an unknown phone with the same credential error", async () => {
    findEnabledByPhoneForLogin.mockResolvedValue(null);

    await expect(createService().rtLogin(loginInfo, ip)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(createService().rtLogin(loginInfo, ip)).rejects.toThrow(
      "账号或密码错误",
    );
    expect(onFail).toHaveBeenCalledWith(phone);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.login_failed", success: false }),
    );
  });

  it("records a failure for a wrong password with the same credential error", async () => {
    findEnabledByPhoneForLogin.mockResolvedValue(user);
    (verifyPayPassword as jest.Mock).mockResolvedValue(false);

    await expect(createService().rtLogin(loginInfo, ip)).rejects.toThrow(
      "账号或密码错误",
    );
    expect(onFail).toHaveBeenCalledWith(phone);
    expect(signToken).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login_failed",
        actorId: user.id,
      }),
    );
  });

  it("propagates lockout thrown by the current failure", async () => {
    findEnabledByPhoneForLogin.mockResolvedValue(null);
    onFail.mockRejectedValue(
      new ForbiddenException("账号已锁定，请300秒后再试"),
    );

    await expect(createService().rtLogin(loginInfo, ip)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(onFail).toHaveBeenCalledWith(phone);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.lockout",
        metadata: expect.objectContaining({ reason: "threshold" }),
      }),
    );
  });

  it("clears lockout and records last login after a successful password check", async () => {
    findEnabledByPhoneForLogin.mockResolvedValue(user);

    const result = await createService().rtLogin(loginInfo, ip);

    expect(onSuccess).toHaveBeenCalledWith(phone);
    expect(recordLoginSuccess).toHaveBeenCalledWith(user.id, ip);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.login",
        actorId: user.id,
        resourceId: user.id,
      }),
    );
    expect(result.body.access_token).toBe("access");
    expect(result.body.userinfo).not.toHaveProperty("password");
  });
});
