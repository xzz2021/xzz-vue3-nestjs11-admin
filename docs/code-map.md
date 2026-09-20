# 代码地图

快速定位「功能 → 路径」。

## Monorepo

| 路径                                  | 说明                                      |
| ------------------------------------- | ----------------------------------------- |
| `package.json`                        | 根脚本：`dev` / `dev:web` / `dev:server` / `build` / `lint` / `typecheck` / `test` / `check` |
| `pnpm-workspace.yaml`                 | `apps/*`；声明了 `packages/*` 但目录当前不存在 |
| `compose.yml`                         | 生产编排（postgres / redis / migrate / server / admin） |
| `compose.local.yml`                   | 本机依赖；映射 5432 / 6379                  |
| `apps/server/.env.example`            | 后端环境变量模板（仓库根目录没有 `.env.example`） |
| `docker/postgres/`                    | DB 用户初始化                             |
| `docker/nginx/nginx.conf`             | admin 容器 Nginx 反代与 SPA               |
| `.github/workflows/ci.yml`            | `lint` + `typecheck` + `test` + `build`            |

## Backend `apps/server`

| 路径                                      | 说明                                |
| ----------------------------------------- | ----------------------------------- |
| `src/main.ts`                             | 启动引导                            |
| `src/app.module.ts`                       | 根模块                              |
| `src/core/`                               | Config、Swagger、静态、Winston      |
| `src/core/app.core.ts`                    | `CORE_MODULE` + `GLOBAL_GUARD`      |
| `src/infrastructure/database/prisma/`     | `PgService`、PostgreSQL adapter     |
| `src/infrastructure/database/redis/`      | Redis 模块、Lua、BullMQ 错误处理    |
| `src/infrastructure/queue/`               | 全局 BullMQ 连接（`QueueInfrastructureModule`） |
| `src/system/app.system.ts`                | 业务模块聚合                        |
| `src/system/auth/`                        | 认证                                |
| `src/system/session/`                     | Access / Refresh 会话               |
| `src/system/user/`                        | 用户                                |
| `src/system/role/`                        | 角色                                |
| `src/system/menu/`                        | 菜单                                |
| `src/system/permission/`                  | 权限 CRUD                           |
| `src/system/department/`                  | 部门                                |
| `src/system/customer/`                    | 客户 Demo（数据权限）               |
| `src/system/dictionary/`                  | 字典                                |
| `src/system/captcha/`                     | 验证码                              |
| `src/system/staticfile/`                  | 本地文件 / 分片上传                 |
| `src/system/oss/`                         | S3 兼容对象存储                     |
| `src/system/db-backup/`                   | `pg_dump` 备份                      |
| `src/system/monitor/`                     | 监控 + WS                           |
| `src/system/online/`                      | 在线 + WS                           |
| `src/system/message/`                     | 消息 + BullMQ + WS                  |
| `src/processor/guard/`                    | JWT、Permission、Throttler、Captcha |
| `src/processor/decorator/`                | Public、RequiredPermission          |
| `src/processor/interceptor/`              | 响应转换、操作日志                  |
| `src/processor/rbac/`                     | 权限缓存                            |
| `src/processor/authorization/`            | DataScope 解析、Grant、快照缓存     |
| `prisma/schema.prisma`                    | 数据模型                            |
| `prisma.config.ts`                        | Prisma 7 配置（`PG_DATABASE_URL`）  |
| `prisma/seed/seed.ts`                     | 种子入口                            |
| `prisma/seed/seed-customers.ts`           | 客户 Demo 种子（主入口默认不调用）  |
| `src/generated/prisma/`                   | Prisma Client 生成结果              |
| `src/generated/zod/`                      | Prisma Zod DTO 生成结果             |

## Frontend `apps/web/src`

| 路径                        | 说明                     |
| --------------------------- | ------------------------ |
| `main.ts` / `permission.ts` | 入口与路由守卫           |
| `router/index.ts`           | 常量/本地异步路由        |
| `axios/`                    | HTTP 与 token 刷新       |
| `api/`                      | 分域 API                 |
| `store/modules/`            | Pinia                    |
| `views/Authorization/`      | 部门/用户/菜单/角色/字典 |
| `views/Customer/`           | 客户权限演示             |
| `views/System/`             | 文件/OSS/消息/在线/监控/日志/备份 |
| `views/Dashboard/`          | 分析/工作台（本地 mock） |
| `views/Personal/`           | 个人中心（依赖服务端菜单） |
| `directives/permission/`    | `v-hasPermi`             |
| `hooks/fn/useRoleMenu.ts`   | 拉菜单并生成路由         |
| `utils/routerHelper.ts`     | 动态路由组件映射         |

前端镜像：`apps/web/Dockerfile`。Nginx 配置在仓库根 `docker/nginx/nginx.conf`。
