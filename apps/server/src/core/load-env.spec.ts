import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAppEnv } from "./load-env.js";

describe("loadAppEnv", () => {
  const original = { ...process.env };
  let dir: string | undefined;

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("loads missing keys from the env file without overriding existing values", () => {
    dir = mkdtempSync(join(tmpdir(), "load-env-"));
    const path = join(dir, ".env");
    writeFileSync(
      path,
      "LOAD_ENV_TEST_KEEP=from-file\nLOAD_ENV_TEST_NEW=from-file\n",
    );
    process.env.LOAD_ENV_TEST_KEEP = "from-process";
    delete process.env.LOAD_ENV_TEST_NEW;

    const result = loadAppEnv({ path });

    expect(result.loaded).toBe(true);
    expect(process.env.LOAD_ENV_TEST_KEEP).toBe("from-process");
    expect(process.env.LOAD_ENV_TEST_NEW).toBe("from-file");
  });

  it("does nothing when the env file is missing", () => {
    const result = loadAppEnv({
      path: join(tmpdir(), "no-such-load-env-file"),
    });
    expect(result.loaded).toBe(false);
  });
});
