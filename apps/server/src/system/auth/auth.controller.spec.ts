import { IS_AUTHENTICATED_KEY, IS_PUBLIC_KEY, PERMISSION_KEY } from "#/processor/decorator/index.js";
import { AuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";
import type { CookieCommand } from "./http-cookie.js";

vi.mock("./auth.service", () => ({
  AuthService: class AuthService {},
}));

vi.mock("#/processor/guard/index.js", () => ({
  CaptchaGuard: class CaptchaGuard {},
  JwtRefreshAuthGuard: class JwtRefreshAuthGuard {},
}));

describe("AuthController authentication boundary", () => {
  it("does not expose the entire controller", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController)).toBeUndefined();
  });

  it.each(["create", "rtLogin", "refresh"] as const)(
    "marks %s as public",
    (methodName) => {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          AuthController.prototype[methodName],
        ),
      ).toBe(true);
    },
  );

  it.each(["logout", "forceLogout"] as const)(
    "keeps %s protected",
    (methodName) => {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          AuthController.prototype[methodName],
        ),
      ).toBeUndefined();
    },
  );

  it("requires login for logout", () => {
    expect(
      Reflect.getMetadata(
        IS_AUTHENTICATED_KEY,
        AuthController.prototype["logout"],
      ),
    ).toBe(true);
  });

  it("requires user update permission for force logout", () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_KEY,
        AuthController.prototype["forceLogout"],
      ),
    ).toBe("user:update");
  });
});

describe("AuthController cookie adapter", () => {
  const setCookie: CookieCommand = {
    action: "set",
    name: "rt",
    value: "refresh-token",
    options: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 1000,
    },
  };
  const clearCookie: CookieCommand = {
    action: "clear",
    name: "rt",
    options: { httpOnly: true, secure: false, sameSite: "lax", path: "/" },
  };

  const cookie = vi.fn();
  const clearCookieFn = vi.fn();
  const res = { cookie, clearCookie: clearCookieFn };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rtLogin writes RT cookie and returns JSON body without cookie", async () => {
    const body = {
      message: "ok",
      userinfo: { id: "u1" },
      access_token: "access",
    };
    const controller = new AuthController({
      rtLogin: vi.fn().mockResolvedValue({ cookie: setCookie, body }),
    } as unknown as AuthService);

    const result = await controller.rtLogin(
      {},
      { ip: "127.0.0.1" } as never,
      res as never,
    );

    expect(result).toEqual(body);
    expect(cookie).toHaveBeenCalledWith(
      "rt",
      "refresh-token",
      setCookie.options,
    );
    expect(clearCookieFn).not.toHaveBeenCalled();
  });

  it("refresh writes rotated RT cookie and returns JSON body without cookie", async () => {
    const body = { access_token: "access", message: "ok" };
    const controller = new AuthController({
      rtRefresh: vi.fn().mockResolvedValue({ cookie: setCookie, body }),
    } as unknown as AuthService);

    const result = await controller.refresh(
      { user: { id: "u1", jti: "old" } } as never,
      res as never,
    );

    expect(result).toEqual(body);
    expect(cookie).toHaveBeenCalledWith(
      "rt",
      "refresh-token",
      setCookie.options,
    );
  });

  it("logout clears RT cookie and returns JSON body without cookie", async () => {
    const body = { message: "退出登录成功", id: "u1" };
    const controller = new AuthController({
      logout: vi.fn().mockResolvedValue({ cookie: clearCookie, body }),
    } as unknown as AuthService);

    const result = await controller.logout(
      { id: "u1" },
      { user: { jti: "j1" } } as never,
      res as never,
    );

    expect(result).toEqual(body);
    expect(clearCookieFn).toHaveBeenCalledWith("rt", clearCookie.options);
    expect(cookie).not.toHaveBeenCalled();
  });
});
