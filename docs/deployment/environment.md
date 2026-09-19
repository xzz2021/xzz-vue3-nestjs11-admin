# 环境变量

仓库**没有**根目录 `.env.example`，也没有 `scripts/generate-production-env.mjs`。本地开发模板是 `apps/server/.env.example`。生产 Compose 读取项目根 `.env`，变量名以 `compose.yml` 和 `src/core/config.ts` 为准。

## 根目录（Compose / Server）

| 变量                                                          | 用途                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`                                                    | 生产为 `production` 时 Zod 强制校验密钥与连接串                       |
| `PORT`                                                        | HTTP 端口（默认 3000）                                                |
| `TOKEN_SECRET` / `TOKEN_REFRESH_SECRET`                       | JWT 密钥（生产校验目前 ≥6 字符；建议自行使用高熵随机值）              |
| `TOKEN_EXPIRES_TIME`                                          | Access 过期（**秒**，代码默认 300）                                   |
| `TOKEN_REFRESH_EXPIRES_TIME`                                  | Refresh 过期（**秒**，代码默认 259200）                               |
| `SSO_COUNT`                                                   | 同用户最大会话数                                                      |
| `SWAGGER` / `SWAGGER_USERNAME` / `SWAGGER_PASSWORD`           | Swagger 开关与 Basic Auth（仅 `SWAGGER=true` 时需要账号）             |
| `HELMET`                                                      | 是否启用 helmet；未设置时生产默认开启                                 |
| `LOG_FILE`                                                    | 本地文件日志，默认 `false`                                            |
| `STATIC_FILE_ROOT_PATH`                                       | 静态磁盘根（如 `public`）                                             |
| `STATIC_FILE_SERVE_ROOT`                                      | 静态 URL 前缀（如 `api/public`）                                      |
| `FILE_UPLOAD_MAX_BYTES`                                       | 本地上传大小上限，默认 500MiB                                         |
| `FILE_UPLOAD_CHUNK_BYTES`                                     | 分片大小，默认 5MiB                                                   |
| `FILE_UPLOAD_SESSION_TTL_HOURS`                               | 分片会话 TTL，默认 24                                                 |
| `FILE_UPLOAD_MAX_OPEN_SESSIONS`                               | 同时未完成分片会话数，默认 5                                          |
| `OSS_S3_ENDPOINT` / `OSS_S3_ACCESS_KEY` / `OSS_S3_SECRET_KEY` / `OSS_S3_BUCKET` | 启用 OSS 时必填。缺一则 `/oss/*` 返回 503，进程仍可启动 |
| `OSS_S3_REGION`                                               | 默认 `us-east-1`                                                      |
| `OSS_S3_FORCE_PATH_STYLE`                                     | 默认 `true`（MinIO 必须）                                             |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_PHONE` | 空库 Seed 超级管理员                                            |
| `POSTGRES_DB`                                                 | 库名                                                                  |
| `POSTGRES_ADMIN_USER` / `POSTGRES_ADMIN_PASSWORD`             | 超级用户                                                              |
| `POSTGRES_MIGRATOR_USER` / `POSTGRES_MIGRATOR_PASSWORD`       | 迁移用户                                                              |
| `POSTGRES_APP_USER` / `POSTGRES_APP_PASSWORD`                 | 运行时用户                                                            |
| `PG_DATABASE_URL`                                             | **migrate** 容器：Compose 原样注入为 Prisma 的 `PG_DATABASE_URL`      |
| `APP_DATABASE_URL`                                            | **server** 容器：Compose 将其注入为进程内的 `PG_DATABASE_URL`         |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_URL`  | Redis                                                                 |
| `DB_BACKUP_DIR`                                               | 容器内备份目录（默认 `/app/apps/server/backups`）                     |
| `DB_BACKUP_CRON`                                              | 默认 cron；运行时配置以数据库 `DbBackupConfig` 为准                   |
| `DB_BACKUP_TIMEZONE`                                          | 默认 `Asia/Shanghai`                                                  |
| `DB_BACKUP_RETENTION_MAX`                                     | 默认保留份数 24                                                       |
| `DB_BACKUP_PREFIX`                                            | 备份文件名前缀                                                        |
| `DB_BACKUP_GZIP`                                              | `true` / `false`，默认 gzip                                           |

### 命名注意

Nest 与 Prisma **只读 `PG_DATABASE_URL`**。Compose 里：

- `migrate`：`PG_DATABASE_URL` ← 宿主机 `.env` 的 `PG_DATABASE_URL`（迁移账号）
- `server`：`PG_DATABASE_URL` ← 宿主机 `.env` 的 `APP_DATABASE_URL`（运行账号）

本地 `apps/server/.env` 直接写 `PG_DATABASE_URL`。生产根目录 `.env` 必须同时提供上述两个 URL。

`apps/server/.env.example` 的 Token 数值是 `30000` / `259200000`，代码按秒读取，不要直接用于生产。

### OSS / S3 CORS

预签名直传要求 bucket CORS 允许管理后台 Origin：

- Methods：`GET`、`PUT`、`HEAD`
- Headers：`Content-Type`、`Authorization`、`x-amz-*`
- ExposeHeaders：`ETag`（multipart complete 需要）

本仓库不自动改 bucket CORS。已有库需在「菜单 / 角色」中自行启用 OSS（seed 只影响空库）。

## Web Vite

文件在 `apps/web/.env.base`、`.env.dev`、`.env.pro`。

| 变量                              | `.env.base`（本地 `--mode base`） | `.env.pro`（`build:pro`） |
| --------------------------------- | --------------------------------- | ------------------------- |
| `VITE_API_BASE_PATH`              | `api/`                            | `/api/`                   |
| `VITE_BASE_PATH`                  | `/`                               | `/`                       |
| `VITE_OUT_DIR`                    | —                                 | `dist-pro`                |

生产构建必须用 **`/api/`**（绝对路径）。`api/` 仅给本地 Vite 开发代理。

## Server 配置加载

`apps/server/src/core/config.ts`：

- `ConfigModule.forRoot({ ignoreEnvFile: true, ... })` — 不自动读 `.env` 文件
- 本地开发能读到 `apps/server/.env`，是因为 Prisma 模块导入了 `dotenv/config`
- `NODE_ENV=production` 时 Zod 校验密钥与 `PG_DATABASE_URL`
