# 编码规范

结合仓库实践与 `.cursor/rules/coding-standard.mdc`。

## TypeScript

- 开启 strict；明确类型；避免 `any`
- 优先 `interface` / `type`；避免巨型函数与重复逻辑
- 后端路径别名 `#/*`，前端 `@/`

## NestJS

| 层                 | 职责                                      |
| ------------------ | ----------------------------------------- |
| Controller         | HTTP、装饰器（权限/Public）、调用 Service |
| Service            | 业务逻辑                                  |
| Repository         | 数据访问（部分模块已拆分）                |
| PgService / Prisma | 持久化客户端                              |
| DTO                | Zod / 生成 DTO 校验                       |
| Guard              | 认证与权限                                |

必须：依赖注入、统一异常过滤、统一响应包装。不要使用 `class-validator`。

### 统一响应

信封只有一套：`ResOp` → `{ code, message, data, timestamp }`。成功由 `TransformInterceptor` 包装；失败由 `AllExceptionsFilter` 写出**相同字段**，且 HTTP status = `code`。

- Controller / Service **只返回业务载荷**，可选 `message`（拦截器会提升到信封）
- 失败只 `throw new BadRequestException / ForbiddenException / ...`，禁止 `return { code: 400 }`
- 文件流、WebSocket、`@SkipWrap()` 不包装

## Prisma

- Schema 字段与注释清晰；复杂写操作使用 transaction
- 注意 N+1；列表查询控制 select/include
- 迁移走 `migrate`，生产用 `migrate deploy`
- Client / Zod 输出在 `src/generated/`，不要引用已删除的 `src/prisma/generated`

## Redis

- Key 语义清晰并设 TTL（会话、验证码、RBAC 缓存、授权快照等）
- 缓存故障时权限 Guard 应返回服务不可用，而非伪装鉴权失败（见现有实现）

## 前端

- 业务 API 放 `apps/web/src/api/<domain>`
- 状态放 Pinia modules；持久化仅必要字段
- 权限按钮统一走指令/组件，与后端 permission code 对齐
- 动态路由组件路径必须能映射到 `views/**/*.vue|tsx`
- 遵循现有 Element Plus + 布局体系

## Git / CI

- 提交前 husky 跑 lint-staged（server oxlint / web eslint），`commit-msg` 走 commitlint conventional
- CI：PR / push 到 main、master 时跑 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- 测试框架是 Vitest，使用 `vi.fn()` / `vi.mock()`
