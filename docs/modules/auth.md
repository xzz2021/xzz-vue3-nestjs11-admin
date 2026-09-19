# Auth 模块

路径：`apps/server/src/system/auth/`

## 能力

| 接口                     | 说明                                        |
| ------------------------ | ------------------------------------------- |
| `POST /auth/register`    | `@Public` 注册；验证码检查当前被注释        |
| `POST /auth/rt/login`    | `@Public` + Captcha；双 token（管理端使用） |
| `POST /auth/refresh`     | Refresh cookie `rt` 换取新 access           |
| `POST /auth/logout`      | 撤销会话、清 cookie、移除 presence          |
| `POST /auth/forceLogout` | 强制下线（权限 `user:update`）              |

没有 `POST /auth/login`。`TokenService` 仍实现单 token 会话，但未对 HTTP 暴露。

## 关键实现

| 文件                                     | 职责                                     |
| ---------------------------------------- | ---------------------------------------- |
| `auth.controller.ts` / `auth.service.ts` | HTTP 写 cookie；Service 返回 cookie 描述 |
| `jwt.strategy.ts`                        | Bearer access，`token.secret`            |
| `jwt.refresh.strategy.ts`                | cookie `rt`，`token.refreshSecret`       |
| `token.service.ts`                       | 单 token 会话（Redis），当前无登录路由   |
| `rt.token.service.ts`                    | 双 token；返回 RT cookie 描述            |
| `http-cookie.ts`                         | cookie 属性（httpOnly、secure、sameSite） |
| `session-registry.ts`                    | SSO 会话列表 / 黑名单                    |
| `lockout.service.ts`                     | 登录锁定（手机号失败计数 / 指数退避）    |

密码：argon2。登录标识：手机号。

## Guard

- 全局：`RtJwtAuthGuard`（`processor/guard/rt-jwt-auth.ts`）
- 刷新专用：`JwtRefreshAuthGuard`
- 登录验证码：`CaptchaGuard`

登录锁定：`lockout.service.ts`。按手机号在 Redis 计数（15 分钟窗口、8 次失败），指数退避锁定（5 分钟起、最长 12 小时）。验证码与全局限流仍保留；不按 IP 锁账号，避免 NAT 误伤。成功登录会清计数并更新 `lastLoginAt` / `lastLoginIp` / `lastLoginLocation`。地理位置解析依赖可选的 `ip2region-ts`，未安装时写「未知」。

## 前端对接

- 登录：`apps/web/src/api/login` → `auth/rt/login`
- Refresh：`apps/web/src/axios/auth.ts`
- Token 存 Pinia persist；RT 依赖浏览器 cookie（`withCredentials: true`）
- `loginOutApi` 为 `GET auth/logout`，与后端 `POST` 不一致，且登出 action 未调用
- 登录页短信/微信入口会请求不存在的后端路由

更多见 [authentication.md](../api/authentication.md)。
