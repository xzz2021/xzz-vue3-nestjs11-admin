# 本地开发

## 环境要求

- Node.js 24.x（根 README / CI / Docker 均按 24）
- pnpm 11.13.1（根 `packageManager`）
- 本地 PostgreSQL、Redis（或只用 Docker 起依赖）

`apps/web` 未声明 engines。

## 安装

```bash
pnpm install
```

Workspace：`apps/*`。`pnpm-workspace.yaml` 还写了 `packages/*`，当前没有该目录。

## 环境变量

1. 后端使用 `apps/server/.env`，可从 `apps/server/.env.example` 复制。需包含 `PG_DATABASE_URL`、`TOKEN_*`、`REDIS_*` 等
2. `compose.local.yml` 读取仓库**根目录** `.env` 的 `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`（密码必填）。须与 `PG_DATABASE_URL` 一致
3. 前端使用 Vite mode：`dev` 脚本为 `--mode base`（`apps/web/.env.base`）
4. Token 时间单位是**秒**。示例文件里的 `30000` / `259200000` 会变成约 8.3 小时 / 8.2 年

## 数据库

- 首次建表：在 `apps/server` 执行 `pnpm prisma migrate dev --name init`
- 种子：`pnpm prisma:seed`。入口 `prisma/seed/seed.ts`，菜单已有数据则整次跳过。生产 migrator 默认不跑 seed。
- 更新 schema 后：`pnpm prisma:gen` 同步 Client，再 `pnpm prisma migrate dev --name <name>`
- 已有迁移记录、库被重置：`pnpm exec prisma migrate deploy` 再 `pnpm exec prisma db seed`
- 客户 Demo 种子在 `prisma/seed/seed-customers.ts`，主入口默认不调用，也没有 `demo:seed` 脚本
- 调试数据库备份需要本机安装 PostgreSQL 客户端（`pg_dump`）并加入 PATH

## 启动

根脚本：

| 命令              | 作用                          |
| ----------------- | ----------------------------- |
| `pnpm dev:server` | Nest watch                    |
| `pnpm dev:web`    | Vite，端口 **4000**           |
| `pnpm dev`        | apps 并行 dev                 |

Web 代理：`/api` → `http://127.0.0.1:3000`（去掉 `/api`）。

仅起依赖可用 `compose.local.yml`。Redis 使用镜像默认配置 + AOF，不依赖外部 `redis.conf`。Postgres 用户/密码/库名从仓库**根目录** `.env` 读取（`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`），须与 `apps/server/.env` 的 `PG_DATABASE_URL` 一致。`POSTGRES_PASSWORD` 未设置时 Compose 会直接失败。

## 质量门

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# 或一次性
pnpm check
```

注意：

- 根 `test` 调用 server 的 `test:ci`（`vitest run`）
- CI 执行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- `pnpm install` 后 husky 会安装 git hooks：pre-commit 跑 lint-staged，commit-msg 跑 commitlint
- server 的 `lint:check` 使用 oxlint

常见问题见 [common-problems](../troubleshooting/common-problems.md)。
