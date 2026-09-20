# Server

NestJS 12 API。详细说明见仓库 [docs](../../docs/README.md)。

## 技术栈

- ORM：Prisma 7（`prisma/schema.prisma`，Client 输出 `src/generated/prisma`）
- DB：PostgreSQL / Redis
- AUTH：JWT（双 token）+ RBAC；CASL 仅用于 Customer
- LOG：Winston；访问日志 / 审计日志走 `/log`
- 校验：Zod + `GlobalZodValidationPipe`

## 本地

1. 准备 PostgreSQL、Redis。连接串写在 `apps/server/.env` 的 `PG_DATABASE_URL`，库名以该 URL 为准（不是旧文档里的 `newback`）。
2. 配置参考 `src/core/config.ts`、`apps/server/.env.example`、根目录 `compose.yml`。
3. `pnpm i`
4. 首次：`pnpm exec prisma migrate dev --name init`，再 `pnpm prisma:seed`
5. `pnpm dev` 或根目录 `pnpm dev:server`

Prisma generate 会生成 Client 和 Zod DTO。没有 `build:minify` 脚本；生产构建用根目录 `pnpm build` 或 `pnpm --filter server build`。根目录 `pnpm prepare` 会安装 Husky hooks（Docker 构建设 `HUSKY=0` 跳过）。
