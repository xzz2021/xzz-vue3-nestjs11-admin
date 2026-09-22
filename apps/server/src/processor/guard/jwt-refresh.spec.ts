import type { RtTokenService } from "#/system/auth/rt.token.service.js";
import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { JwtRefreshAuthGuard } from "./jwt-refresh.js";

describe("JwtRefreshAuthGuard", () => {
  const isBlacklisted = vi.fn();
  const listSessions = vi.fn();
  const rtTokenService = {
    isBlacklisted,
    listSessions,
  } as unknown as RtTokenService;

  const createContext = (
    user?: { id?: string; jti?: string },
    url = "/auth/refresh",
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ url, user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi
      .spyOn(AuthGuard("jwt-refresh").prototype, "canActivate")
      .mockResolvedValue(true);
  });

  it("rejects blacklisted refresh tokens even when jwt signature is valid", async () => {
    const guard = new JwtRefreshAuthGuard(rtTokenService);
    isBlacklisted.mockResolvedValue(true);

    await expect(
      guard.canActivate(createContext({ id: "user-1", jti: "jti-1" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(isBlacklisted).toHaveBeenCalledWith("jti-1");
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("rejects refresh tokens missing from the active session list", async () => {
    const guard = new JwtRefreshAuthGuard(rtTokenService);
    isBlacklisted.mockResolvedValue(false);
    listSessions.mockResolvedValue(["other-jti"]);

    await expect(
      guard.canActivate(createContext({ id: "user-1", jti: "jti-1" })),
    ).rejects.toThrow("rt token not active");
  });

  it("allows active non-blacklisted refresh tokens", async () => {
    const guard = new JwtRefreshAuthGuard(rtTokenService);
    isBlacklisted.mockResolvedValue(false);
    listSessions.mockResolvedValue(["jti-1"]);

    await expect(
      guard.canActivate(createContext({ id: "user-1", jti: "jti-1" })),
    ).resolves.toBe(true);
  });

  it("does not skip refresh JWT for /public/ URLs", async () => {
    const jwtSpy = vi
      .spyOn(AuthGuard("jwt-refresh").prototype, "canActivate")
      .mockResolvedValue(false);
    const guard = new JwtRefreshAuthGuard(rtTokenService);

    await expect(
      guard.canActivate(createContext(undefined, "/public/refresh-bypass")),
    ).resolves.toBe(false);
    expect(jwtSpy).toHaveBeenCalled();
  });
});
