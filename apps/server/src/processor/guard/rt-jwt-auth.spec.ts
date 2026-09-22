import type { RtTokenService } from "#/system/auth/rt.token.service.js";
import type { TokenService } from "#/system/auth/token.service.js";
import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { RtJwtAuthGuard } from "./rt-jwt-auth.js";

describe("RtJwtAuthGuard", () => {
  const isAccessBlacklisted = vi.fn();
  const isRtBlacklisted = vi.fn();
  const tokenService = {
    isBlacklisted: isAccessBlacklisted,
  } as unknown as TokenService;
  const rtTokenService = {
    isBlacklisted: isRtBlacklisted,
  } as unknown as RtTokenService;

  const createContext = (
    user?: { jti?: string },
    url = "/user/list",
  ): ExecutionContext =>
    ({
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => ({ url, user }),
      }),
      getHandler: () => ({}),
      getClass: () => class {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi
      .spyOn(AuthGuard("jwt").prototype, "canActivate")
      .mockResolvedValue(true);
  });

  it("rejects access tokens blacklisted by either token service", async () => {
    const guard = new RtJwtAuthGuard(
      new Reflector(),
      tokenService,
      rtTokenService,
    );
    isAccessBlacklisted.mockResolvedValue(false);
    isRtBlacklisted.mockResolvedValue(true);

    await expect(
      guard.canActivate(createContext({ jti: "jti-1" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(isAccessBlacklisted).toHaveBeenCalledWith("jti-1");
    expect(isRtBlacklisted).toHaveBeenCalledWith("jti-1");
  });

  it("allows non-blacklisted access tokens", async () => {
    const guard = new RtJwtAuthGuard(
      new Reflector(),
      tokenService,
      rtTokenService,
    );
    isAccessBlacklisted.mockResolvedValue(false);
    isRtBlacklisted.mockResolvedValue(false);

    await expect(
      guard.canActivate(createContext({ jti: "jti-1" })),
    ).resolves.toBe(true);
  });

  it("does not skip JWT for /public/ URLs without @Public()", async () => {
    const jwtSpy = vi
      .spyOn(AuthGuard("jwt").prototype, "canActivate")
      .mockResolvedValue(false);
    const guard = new RtJwtAuthGuard(
      new Reflector(),
      tokenService,
      rtTokenService,
    );

    await expect(
      guard.canActivate(createContext(undefined, "/public/secret-api")),
    ).resolves.toBe(false);
    expect(jwtSpy).toHaveBeenCalled();
  });

  it("skips JWT only when @Public() is set", async () => {
    const reflector = {
      getAllAndOverride: () => true,
    } as unknown as Reflector;
    const jwtSpy = vi
      .spyOn(AuthGuard("jwt").prototype, "canActivate")
      .mockResolvedValue(false);
    const guard = new RtJwtAuthGuard(reflector, tokenService, rtTokenService);

    await expect(
      guard.canActivate(createContext(undefined, "/auth/register")),
    ).resolves.toBe(true);
    expect(jwtSpy).not.toHaveBeenCalled();
  });
});
