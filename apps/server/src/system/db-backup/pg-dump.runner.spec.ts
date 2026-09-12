import type { BackupRuntimeConfig } from "./db-backup.types.js";
import {
  buildBackupPaths,
  buildPgDumpArgs,
  PgDumpRunner,
} from "./pg-dump.runner.js";

const runtimeConfig: BackupRuntimeConfig = {
  dir: "backups",
  enabled: true,
  cron: "0 0 * * * *",
  timezone: "Asia/Shanghai",
  retentionMax: 24,
  filePrefix: "backstage_db",
  gzip: true,
};

describe("PgDumpRunner", () => {
  it("builds timestamped file names with gzip suffix", () => {
    const now = new Date(2026, 6, 30, 12, 34, 56);
    const paths = buildBackupPaths(runtimeConfig, now);

    expect(paths.fileName).toBe("backstage_db_20260730_123456.sql.gz");
    expect(paths.tempPath.endsWith(".tmp")).toBe(true);
  });

  it("builds pg_dump args without exposing password", () => {
    const args = buildPgDumpArgs(
      new URL("postgresql://app_runtime:secret%40123@localhost:5432/admin2"),
    );

    expect(args).toEqual([
      "-Fp",
      "--no-owner",
      "--no-privileges",
      "--host",
      "localhost",
      "--port",
      "5432",
      "--username",
      "app_runtime",
      "--dbname",
      "admin2",
    ]);
    expect(args.join(" ")).not.toContain("secret");
  });

  it("rejects when database url is missing", async () => {
    const runner = new PgDumpRunner();

    await expect(runner.run(runtimeConfig, "")).rejects.toThrow(
      "PG_DATABASE_URL 未配置",
    );
  });
});
