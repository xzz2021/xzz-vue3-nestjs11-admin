# 扩展指南

按现有分层加业务，避免再造一套认证、权限或响应信封。

## 后端新模块

1. 在 `apps/server/src/system/<name>/` 建立 `*.module.ts` / `*.controller.ts` / `*.service.ts`，需要时再加 `*.repository.ts` 与 Zod DTO。
2. 把 Module 注册进 `src/system/app.system.ts` 的 `CORE_SYSTEM_MODULE`。
3. Controller 只处理 HTTP：参数、装饰器、调用 Service。
4. 需要登录的接口加 `@RequiredPermission('resource:action')`。漏写会变成「任意登录用户可访问」。纯登录接口保持无权限码；公开接口用 `@Public()`。
5. 写操作成功后如需审计，调用 `AuditLogService.record()`。
6. 返回业务载荷即可，不要手写 `{ code, data }`。

参考现成拆分较完整的模块：`customer`、`user`、`role`、`message`。

## 权限与菜单

1. 在菜单管理页增加菜单，`component` 填前端视图路径，例如 `views/Foo/Index`。
2. 在该菜单下增加 Permission，`code` 形如 `foo:view`。
3. 角色页勾选菜单和权限。超管 `super_admin` 不需要逐条授权。
4. 需要行级范围时走 `AuthorizationService` + 资源 Policy，不要在 Controller 里手写部门过滤。当前完整范例是 Customer。

空库 seed 只在 `Menu.count() === 0` 时灌入。已有库请用管理页或增量脚本，不要依赖重复 `prisma db seed`。

## Schema

1. 改 `apps/server/prisma/schema.prisma`。
2. `pnpm --filter server prisma:gen`
3. `pnpm --filter server exec prisma migrate dev --name <name>`
4. 生成的 Client / Zod 在 `src/generated/`，业务代码从 `#/generated/...` 引用。

## 前端新页面

1. 页面放 `apps/web/src/views/<Domain>/`
2. API 放 `apps/web/src/api/<domain>/`
3. 默认开启服务端动态路由：只要后端菜单 `component` 能 glob 到该文件即可，不必写入本地 `asyncRouterMap`
4. 按钮用 `v-hasPermi`，权限码与后端一致
5. 不要把 dashboard 那种本地 mock 模式复制到真实业务

## 不要做的事

- 不要恢复 `POST /auth/login` 作为管理端主登录，除非明确废弃双 token
- 不要新增第二套响应格式或 class-validator
- 不要在前端指令里当作安全边界
- 不要假设存在 `packages/` 共享包或根 `.env.example`
