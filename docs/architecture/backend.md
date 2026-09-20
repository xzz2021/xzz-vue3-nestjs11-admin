# 后端架构

路径：`apps/server`

## 入口与模块装配

| 文件                       | 作用                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `src/main.ts`              | 启动、WsAdapter、trust proxy=私网、Helmet、cookie-parser、Zod 管道、Swagger（可关） |
| `src/app.module.ts`        | 导入 `CORE_MODULE` + `CORE_SYSTEM_MODULE`，注册全局 Guard                           |
| `src/core/app.core.ts`     | 基础设施模块聚合                                                                    |
| `src/core/config.ts`       | Zod 校验的应用配置                                                                  |
| `src/system/app.system.ts` | 业务模块聚合                                                                        |

全局 HTTP 前缀 `api` 在 `main.ts` 中**已注释**，Nest 路由为根路径（如 `/auth/rt/login`）。生产由 Nginx 去掉 `/api` 后转发。CORS 同样注释，依赖同源反代。

## CORE_MODULE

| 模块                           | 作用                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| ConfigModule                   | Zod 校验（`ignoreEnvFile: true`，依赖进程环境；本地 `.env` 由 Prisma 侧 `dotenv/config` 间接加载） |
| ServeStatic + StaticfileModule | 静态目录与文件上传 API                                             |
| AppRedisModule                 | Redis 全局客户端与健康检查                                         |
| QueueInfrastructureModule      | 全局 `BullModule.forRootAsync`（消息 / 文件清理 / 备份共用连接）   |
| RbacModule                     | 权限 Redis 缓存                                                    |
| AuthorizationModule            | DataScope 快照与 Grant                                             |
| UserPersistenceModule          | 用户仓储，供授权/会话复用                                          |
| ThrottlerModule                | 全局限流（Redis 存储，默认 60s / 100 次）                          |
| PrismaModule                   | `PgService`（`src/infrastructure/database/prisma/`）               |
| WinstonLoggerModule            | 日志 + `/log` 访问日志 / 审计日志 API                              |

## CORE_SYSTEM_MODULE

| 模块             | 职责                                                          |
| ---------------- | ------------------------------------------------------------- |
| SessionModule    | Access/RT 令牌、会话吊销、领域事件                            |
| AuthModule       | 注册/登录/刷新/登出、JWT Strategy                             |
| CaptchaModule    | SVG 图形/数学验证码                                           |
| UserModule       | 用户 CRUD、个人信息、头像、密码                               |
| RoleModule       | 角色与菜单权限分配                                            |
| MenuModule       | 菜单树 CRUD、排序                                             |
| PermissionModule | 按钮等权限 CRUD（挂菜单）                                     |
| DepartmentModule | 部门树                                                        |
| DictionaryModule | 字典类型/字典项                                               |
| CustomerModule   | 客户 Demo（CASL + DataScope）                                 |
| DbBackupModule   | `pg_dump` 调度、下载、保留                                    |
| OssModule        | S3 兼容对象存储                                               |
| MonitorModule    | 系统快照 + `/monitor/ws` + 延迟采样拦截器                     |
| OnlineModule     | Presence：在线用户 + `/online/ws`                             |
| MessageModule    | 收件箱 + 投递 + BullMQ + `/message/ws`                        |

`StaticfileModule` 在 `CORE_MODULE`，不在 `app.system.ts`。`FileCleanupModule` 由 Staticfile / User / DbBackup 间接引入。

## 全局 Guard 顺序

1. `GlobalThrottlerGuard` — 限流
2. `RtJwtAuthGuard` — Access JWT（仅 `@Public()` 跳过；静态资源由独立中间件处理；WS 交由 Gateway 自鉴权）
3. `PermissionGuard` — `@Public()` 放行；`@RequiredPermission` 校验权限码；`@Authenticated()` 仅需登录；**未标注则拒绝**

拦截器：`OperationLogInterceptor` → `TransformInterceptor`。过滤器：`AllExceptionsFilter`。

## 横切能力（processor）

| 类型        | 已启用                    | 说明                                                        |
| ----------- | ------------------------- | ----------------------------------------------------------- |
| Pipe        | GlobalZodValidationPipe   | 请求体校验，失败 HTTP 422                                   |
| Filter      | AllExceptionsFilter       | 统一异常                                                    |
| Interceptor | TransformInterceptor      | 成功响应包装为 `ResOp` `{ code, data, message, timestamp }` |
| Interceptor | OperationLogInterceptor   | 写 `UserOperationLog` 访问日志                              |
| Interceptor | MonitorLatencyInterceptor | 监控模块内延迟采样，非全局                                  |

未全局启用但代码库存在的示例：Timeout / Idempotence Interceptor、PoliciesGuard（CASL 全局设想）等。Customer 的 CASL 在 `customer.policy.ts` 内使用，不走全局 PoliciesGuard。

## WebSocket

| Gateway        | 路径          |
| -------------- | ------------- |
| OnlineGateway  | `/online/ws`  |
| MonitorGateway | `/monitor/ws` |
| MessageGateway | `/message/ws` |

使用 `@nestjs/platform-ws`；连接时自行校验 JWT（query 或 header）。

## 依赖要点（package.json）

- NestJS 12 全家桶、Passport JWT、argon2、Prisma 7.10 + `@prisma/adapter-pg`
- Redis：`@liaoliaots/nestjs-redis`、`ioredis`
- 队列：`@nestjs/bullmq` + `bullmq`（消息、文件清理、数据库备份）
- 校验：`nestjs-zod` + `zod` 4
- 限流：`@nestjs/throttler` + Redis 存储
- 验证码：`svg-captcha`
- 对象存储：`@aws-sdk/client-s3`
- 路径别名：`#/*` → `src/*`

## 测试

- 单元：Vitest（`src/**/*.spec.ts`，`pnpm --filter server test` / 根目录 `pnpm test` → `test:ci`）
- E2E 配置：`vitest.config.e2e.ts`；没有 `*.e2e-spec.ts` 时允许 0 测试通过
- CI 跑 lint / typecheck / test / build
