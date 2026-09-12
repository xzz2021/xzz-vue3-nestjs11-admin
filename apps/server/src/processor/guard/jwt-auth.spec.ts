import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { JwtAuthGuard } from "./jwt-auth";

describe("JwtAuthGuard", () => {
  const createContext = (
    url: string,
    user?: { sub?: number },
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ url, user }),
      }),
      getHandler: () => ({}),
      getClass: () => class {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("does not skip JWT for /public/ URLs without @Public()", async () => {
    const jwtSpy = jest
      .spyOn(AuthGuard("jwt").prototype, "canActivate")
      .mockResolvedValue(false);
    const guard = new JwtAuthGuard(new Reflector());

    await expect(
      guard.canActivate(createContext("/public/secret-api")),
    ).resolves.toBe(false);
    expect(jwtSpy).toHaveBeenCalled();
  });

  it("skips JWT only when @Public() is set", async () => {
    const reflector = {
      getAllAndOverride: () => true,
    } as unknown as Reflector;
    const jwtSpy = jest
      .spyOn(AuthGuard("jwt").prototype, "canActivate")
      .mockResolvedValue(false);
    const guard = new JwtAuthGuard(reflector);

    await expect(
      guard.canActivate(createContext("/auth/register")),
    ).resolves.toBe(true);
    expect(jwtSpy).not.toHaveBeenCalled();
  });
});
