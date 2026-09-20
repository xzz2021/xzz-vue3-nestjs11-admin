# 前端架构

路径：`apps/web`（包名 `web`，基于 vue-element-plus-admin 改造）。Compose 服务名仍为 `admin`。

## 技术栈

Vue 3.5、TypeScript 6、Vite 8、Element Plus 2.14、Pinia 4、Vue Router 5（Hash 模式）、Axios、UnoCSS、vue-i18n 11。

## 目录结构

```
src/
├── api/           # 按域划分的 HTTP 封装
├── axios/         # 实例、鉴权刷新、错误与取消
├── components/    # 通用组件（含 Permission、Menu、Form、Table）
├── constants/
├── directives/    # v-hasPermi
├── hooks/
├── layout/
├── locales/
├── plugins/
├── router/        # index.ts 常量路由 + 本地 asyncRouterMap
├── store/modules/ # Pinia
├── utils/
├── views/         # 页面
├── permission.ts  # 路由守卫
└── main.ts
```

## 路由

- 历史模式：`createWebHashHistory()`
- 常量路由：登录、404、部分隐藏页（角色分配/详情、菜单编辑等）
- 本地 `asyncRouterMap`：Dashboard + Authorization（Department/User/Menu/Role）
- 个人中心、Customer、Dictionary、System 页面**不在**常量路由里，依赖服务端菜单动态挂载
- 默认 `dynamicRouter` + `serverDynamicRouter` 为 true → **以服务端菜单为主**生成可访问路由
- 组件映射：`import.meta.glob('../views/**/*.{vue,tsx}')`；`#` → Layout，`##` → ParentLayout

### views 页面

| 目录                                | 说明                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Authorization/                      | Department、User、Menu、Role、Dictionary                                      |
| Customer/                           | 客户数据权限 Demo                                                             |
| Dashboard/                          | Analysis、Workplace（接口为本地 mock）                                        |
| System/                             | File、Oss、Message、Notification、OnlineUser、Server、UserLog、AuditLog、DatabaseBackup |
| Login / Personal / Error / Redirect | 登录、个人中心、错误页                                                        |

## Pinia Stores

| Store                                 | 用途                                              |
| ------------------------------------- | ------------------------------------------------- |
| user                                  | 用户信息、access token、roleRouters、登出         |
| permission                            | 动态路由生成                                      |
| app                                   | 布局主题、`dynamicRouter` / `serverDynamicRouter` |
| role / department / dictionary        | 对应业务列表状态                                  |
| message / onlinePresence              | 消息未读、presence WS                             |
| tagsView / locale / lock              | 标签页、语言、锁屏                                |

没有独立的 `system` / `oss` store。OSS 页面直接调 API。

## API 层

- `baseURL = import.meta.env.VITE_API_BASE_PATH`（开发 `api/`，生产 `/api/`）
- 开发代理：Vite `/api` → `http://127.0.0.1:3000`，rewrite 去掉 `/api`
- 业务成功码：`code === 200`
- 401/406：调用 `POST /auth/refresh`（cookie 携带 refresh），刷新 access 后重试

登录主路径：`auth/rt/login`（双 token，refresh 存 httpOnly cookie `rt`）。

部分 `api/dashboard`、`api/table` 使用本地 mock（`_local.ts`），**不请求真实后端**。

前端另有短信/微信登录 API 与 UI 入口，**后端没有对应 Controller**，调用会 404。确认登出调用 `POST /auth/logout`，并清理动态路由。

## 权限（前端）

1. 登录后 `getRoleMenuApi`（`role/getRoleMenu`）→ 动态加路由
2. 侧栏读 `permissionStore.getRouters`
3. 按钮：`v-hasPermi`、`<Permission>`、页面内校验都读 `meta.permissions`（`getRoutePermissions`；旧的 `meta.permission` 仅作回退）

无独立 Permission 管理页；按钮权限在菜单管理中维护。前端指令只控制展示，真正安全边界在后端 Guard。

## 构建与运行

| 脚本                    | 说明                                      |
| ----------------------- | ----------------------------------------- |
| `pnpm --filter web dev` | `--mode base`，端口 4000                  |
| 根脚本 `pnpm dev:web`   | 同上                                      |
| `build:pro`             | `--mode pro` → `dist-pro`                 |
| Docker                  | `apps/web/Dockerfile` → nginx 托管 `dist-pro` |

详见 [local-development](../development/local-development.md)、[docker](../deployment/docker.md)。
