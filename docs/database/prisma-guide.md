# Prisma 使用说明

Prisma 版本：**7.10.0**。不要按根 `package.json` 描述里的 “prisma8” 理解。

## 位置

| 路径                                              | 说明                              |
| ------------------------------------------------- | --------------------------------- |
| `apps/server/prisma/schema.prisma`                | Schema                            |
| `apps/server/prisma.config.ts`                    | Prisma 7 配置（datasource URL）   |
| `apps/server/prisma/migrations/`                  | 迁移                              |
| `apps/server/src/generated/prisma`                | Client 输出                       |
| `apps/server/src/generated/zod`                   | Zod schema 输出（prisma-zod-generator） |
| `apps/server/src/infrastructure/database/prisma/` | `PgService`、adapter、模块        |
| `apps/server/prisma/seed/seed.ts`                 | 种子入口                          |
| `apps/server/prisma/zod-generator.config.json`    | Zod 生成器配置（models-only）     |

## Generator

- `prisma-client`：`moduleFormat = esm`，`importFileExtension = js`，输出到 `src/generated/prisma`
- `prisma-zod-generator`：根据 `/// @zod.xxx` 注释生成 pure model schemas（`UserSchema` 等）

Datasource：`provider = postgresql`。URL 由 `prisma.config.ts` 读取 `PG_DATABASE_URL`，不在 schema 写死。

## 常用命令

在 `apps/server` 或 `--filter server` 下：

```bash
pnpm prisma generate          # 或 pnpm prisma:gen
pnpm prisma migrate dev
pnpm prisma migrate deploy    # 生产 / migrator 镜像
pnpm prisma db seed           # 或 pnpm prisma:seed
pnpm prisma validate          # 或 pnpm prisma:val
```

Docker `migrate` 服务默认只 `prisma migrate deploy`。空库首次初始化再设 `RUN_DB_SEED=1`，或手动 `pnpm prisma:seed`。

## Nest 集成

- `PrismaModule` 全局导出 `PgService`
- `PgService` 使用 `@prisma/adapter-pg`，默认 omit `User.password`
- 路径别名：`#/*` → `src/*`（例如 `#/generated/prisma/...`、`#/infrastructure/database/prisma/...`）
- 数据库不可用时进程仍会启动，后台每 5 秒重连

## 实践注意

1. 运行时与迁移均使用环境变量 **`PG_DATABASE_URL`**（Compose 里 server 实际注入的是宿主机 `APP_DATABASE_URL`）
2. 复杂写入使用事务（角色权限同步、客户更新 `FOR UPDATE` + 乐观锁等）
3. 生产镜像使用 Node 24.18
4. Windows 上若 `prisma-zod-generator` 的 install scripts 被跳过，需在 `pnpm-workspace.yaml` 的 `allowBuilds` 中设为 `true`
5. `Boolean @default(false)` / `Int @default(0)` 等假值默认，当前生成器可能不会自动落到 Zod `.default(...)`；在 `/// @zod....default(false)`（或 `.default(0)`）注解链**末尾**显式补上
6. 业务侧统一使用生成的 `*Schema`（如 `UserSchema`），不要再依赖旧的 `*Model` Zod 命名；枚举从 `#/generated/prisma/enums.js` 引入
