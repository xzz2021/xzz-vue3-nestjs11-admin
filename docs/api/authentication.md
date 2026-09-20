# 认证与鉴权 API

## 登录方式

### 双 Token（管理端默认，当前唯一登录接口）

`POST /auth/rt/login`（Public + CaptchaGuard）

1. 校验验证码（cookie `captchaId` / `captchaText`，服务端 Redis）
2. 账号锁定检查（Redis，按手机号；已锁定返回 403）
3. 校验手机号 + 密码（argon2）；失败计入窗口，达阈值后锁定
4. 签发 access（响应体）+ refresh（httpOnly cookie `rt`）
5. 会话登记 Redis，受 `SSO_COUNT` 限制

验证码校验成功会原子消费 Redis 记录（匹配则 `GET`+`DEL`），同一 captcha 不能重放。密码错误后需重新获取验证码。TTL 仍为 5 分钟。

### 单 Token

`TokenService` 仍保留单 token 会话能力，但 **Controller 没有 `POST /auth/login`**。管理端不要按该接口对接。

### 注册

`POST /auth/register`：Public。当前不校验验证码（相关检查被注释），直接创建 enabled 用户。

## 验证码

| 方法 | 路径                 | 说明       |
| ---- | -------------------- | ---------- |
| GET  | `/captcha/common`    | 字母图形   |
| GET  | `/captcha/math_expr` | 数学表达式 |

类级 `@Public`，限流约 10 次 / 50s。

## 刷新

`POST /auth/refresh`：Public + `JwtRefreshAuthGuard`

- 读取 cookie `rt`
- 校验签名、黑名单、会话列表
- 轮换 token，返回新 `access_token`

前端：业务 401/406 时自动刷新并重试；并发共用单一 `refreshPromise`。

## 登出 / 强制下线

| 接口                             | 说明                                   |
| -------------------------------- | -------------------------------------- |
| `POST /auth/logout`              | 撤销 access/RT、清 cookie、去 presence |
| `POST /auth/forceLogout`         | 管理员强制下线（`user:update`）        |
| `POST /online/kick` / `kickUser` | 在线模块踢人（`onlineUser:kick`）      |

前端：确认登出时 `POST /auth/logout`（独立 axios，避免走 401 刷新环）；随后 `resetRouter()` 并清空 permission store。Token 已失效时的自动登出只清本地。

## 全局鉴权顺序

```
Throttler → RtJwtAuthGuard → PermissionGuard
```

- `@Public()`：跳过 JWT
- `@Authenticated()`：需要登录，不校验权限码
- `@RequiredPermission`：校验权限码
- 未标注上述任一装饰器：拒绝
- 静态文件：由独立中间件按 `STATIC_FILE_ROOT_PATH` 前缀提供，不经过 JWT Guard
- WebSocket：全局 JWT 返回 false，由各 Gateway 自行验 token

## 密钥与过期（环境变量）

| 变量                         | 用途                            |
| ---------------------------- | ------------------------------- |
| `TOKEN_SECRET`               | Access JWT                      |
| `TOKEN_REFRESH_SECRET`       | Refresh JWT                     |
| `TOKEN_EXPIRES_TIME`         | Access 过期**秒数**（代码默认 300） |
| `TOKEN_REFRESH_EXPIRES_TIME` | Refresh 过期**秒数**（代码默认 259200） |
| `SSO_COUNT`                  | 同用户最大会话数                |

`apps/server/.env.example` 里写的是 `30000` / `259200000`。代码按秒解析，会得到约 8.3 小时 / 8.2 年，不要把这两个示例值当成 30 秒 / 3 天。生产校验目前只要求 JWT secret 长度 ≥ 6。

详见 [environment.md](../deployment/environment.md)。
