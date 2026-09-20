import { applyCookieCommand, type CookieCommand } from "./http-cookie.js";

describe("applyCookieCommand", () => {
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const res = { cookie, clearCookie };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets cookie from a set command", () => {
    const command: CookieCommand = {
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

    applyCookieCommand(res, command);

    expect(cookie).toHaveBeenCalledWith("rt", "refresh-token", command.options);
    expect(clearCookie).not.toHaveBeenCalled();
  });

  it("clears cookie from a clear command", () => {
    const command: CookieCommand = {
      action: "clear",
      name: "rt",
      options: { httpOnly: true, secure: false, sameSite: "lax", path: "/" },
    };

    applyCookieCommand(res, command);

    expect(clearCookie).toHaveBeenCalledWith("rt", command.options);
    expect(cookie).not.toHaveBeenCalled();
  });
});
