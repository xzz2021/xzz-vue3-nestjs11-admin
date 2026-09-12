import { Injectable } from "@nestjs/common";
import { createGzip } from "node:zlib";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

import type {
  BackupRuntimeConfig,
  BackupExecutionResult,
} from "./db-backup.types.js";

@Injectable()
export class PgDumpRunner {
  async run(
    config: BackupRuntimeConfig,
    databaseUrl: string,
  ): Promise<BackupExecutionResult> {
    if (!databaseUrl) {
      throw new Error("PG_DATABASE_URL 未配置");
    }

    const startedAt = new Date();
    const { fileName, filePath, tempPath } = buildBackupPaths(config);
    const url = new URL(databaseUrl);
    const args = buildPgDumpArgs(url);
    const child = spawn("pg_dump", args, {
      env: {
        ...process.env,
        PGPASSWORD: decodeURIComponent(url.password),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    // 先确认进程已拉起：否则 spawn 失败时管道会先以 premature close 失败，掩盖真正的 ENOENT
    try {
      await waitForSpawn(child);
    } catch (error) {
      throw toRunnerError(error);
    }

    await fs.mkdir(dirname(filePath), { recursive: true });
    const target = createWriteStream(tempPath, { flags: "w" });

    try {
      await Promise.all([
        config.gzip
          ? pipeline(child.stdout, createGzip(), target)
          : pipeline(child.stdout, target),
        waitForChild(child, () => stderr),
      ]);
      await fs.rename(tempPath, filePath);
    } catch (error) {
      await safeUnlink(tempPath);
      throw toRunnerError(error);
    }

    const [stat, checksum] = await Promise.all([
      fs.stat(filePath),
      hashFile(filePath),
    ]);
    if (stat.size <= 0) {
      await safeUnlink(filePath);
      throw new Error("备份文件为空");
    }

    return {
      fileName,
      filePath,
      fileSize: BigInt(stat.size),
      checksum,
      startedAt,
      finishedAt: new Date(),
    };
  }
}

export function buildPgDumpArgs(url: URL): string[] {
  const database = url.pathname.replace(/^\//, "");
  if (!database) {
    throw new Error("PG_DATABASE_URL 缺少数据库名");
  }

  const args = [
    "-Fp",
    "--no-owner",
    "--no-privileges",
    "--host",
    url.hostname,
    "--port",
    url.port || "5432",
    "--username",
    decodeURIComponent(url.username),
    "--dbname",
    database,
  ];

  return args;
}

export function buildBackupPaths(
  config: BackupRuntimeConfig,
  now = new Date(),
) {
  const dir = resolve(config.dir);
  const stamp = formatTimestamp(now);
  const ext = config.gzip ? "sql.gz" : "sql";
  const fileName = `${config.filePrefix}_${stamp}.${ext}`;
  const filePath = resolve(dir, fileName);
  const tempPath = `${filePath}.tmp`;
  return { fileName, filePath, tempPath };
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function waitForSpawn(child: ReturnType<typeof spawn>): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.once("spawn", resolvePromise);
    child.once("error", rejectPromise);
  });
}

async function waitForChild(
  child: ReturnType<typeof spawn>,
  getStderr: () => string,
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error((getStderr() || `pg_dump exited with code ${code}`).trim()),
      );
    });
  });
}

/** 将生产镜像依赖缺失转换为明确的部署错误。 */
function toRunnerError(error: unknown): Error {
  if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
    return new Error("生产镜像缺少 pg_dump，请重新构建 server 镜像");
  }
  return error instanceof Error ? error : new Error(String(error));
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await fs.unlink(path);
  } catch {
    // ignore
  }
}
