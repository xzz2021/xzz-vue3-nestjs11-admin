import type { TokenService } from "#/system/auth/token.service";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { TokenGuard } from "./token";

describe("TokenGuard", () => {
  const tokenService = {
    isBlacklisted: vi.fn(),
    listSessions: vi.fn(),
  } as unknown as TokenService;

  const createContext = (
    url: string,
    user?: { sub?: string; jti?: string },
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ url, user }),
      }),
      getHandler: () => ({}),
      getClass: () => class {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("does not skip token auth for /public/ URLs without @Public()", async () => {
    const jwtSpy = jest
      .spyOn(AuthGuard("token").prototype, "canActivate")
      .mockResolvedValue(false);
    const guard = new TokenGuard(new Reflector(), tokenService);

    await expect(
      guard.canActivate(createContext("/public/secret-api")),
    ).resolves.toBe(false);
    expect(jwtSpy).toHaveBeenCalled();
  });
});
