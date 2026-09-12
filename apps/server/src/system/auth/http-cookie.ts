export const RT_COOKIE_NAME = "rt";

export interface CookieFlags {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
}

export type CookieCommand =
  | { action: "set"; name: string; value: string; options: CookieFlags }
  | { action: "clear"; name: string; options: CookieFlags };

export interface CookieWriter {
  cookie(name: string, value: string, options?: CookieFlags): unknown;
  clearCookie(name: string, options?: CookieFlags): unknown;
}

export function applyCookieCommand(
  res: CookieWriter,
  command: CookieCommand,
): void {
  if (command.action === "clear") {
    res.clearCookie(command.name, command.options);
    return;
  }
  res.cookie(command.name, command.value, command.options);
}
