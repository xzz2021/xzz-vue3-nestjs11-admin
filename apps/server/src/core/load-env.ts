import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";

export function loadAppEnv(options?: { path?: string; override?: boolean }) {
  const path = options?.path;
  if (path) {
    if (!existsSync(path)) {
      return { loaded: false as const };
    }
    loadDotenv({ path, override: options?.override ?? false, quiet: true });
    return { loaded: true as const, path };
  }

  const result = loadDotenv({ override: options?.override ?? false, quiet: true });
  if (result.error) {
    return { loaded: false as const };
  }
  return { loaded: true as const };
}

loadAppEnv();
