# 常见问题

## 本地后端读不到 `.env`

`ConfigModule` 设置了 `ignoreEnvFile: true`。本地能读到 `apps/server/.env`，是因为 Prisma 模块导入了 `dotenv/config`。如果启动顺序变化导致环境变量为空，检查进程环境或在启动前显式加载 `.env`。

## Prisma Client 路径找不到

生成结果在 `apps/server/src/generated/prisma`，不是旧路径 `src/prisma/generated` 或 `src/prisma/schema`。导入使用 `#/generated/prisma/...`。改 schema 后执行 `pnpm --filter server prisma:gen`。

## 前端命令失败

包名是 `web`，目录是 `apps/web`。正确命令：

```bash
pnpm dev:web
pnpm --filter web dev
pnpm --filter web build
```

没有 `dev:admin` / `--filter admin`。

## 登录验证码 / cookie

开发环境必须让验证码请求和登录请求都 `withCredentials: true`，否则 `captchaId` cookie 带不上。验证码 TTL 5 分钟；校验成功会立即消费 Redis 记录，不能重放。密码错误后需重新获取验证码。

## 刷新失败 / 一直 401

Refresh 走 `POST /auth/refresh`，依赖 httpOnly cookie `rt`。生产必须同源 `/api` 反代。Nest CORS 默认关闭（`CORS_ORIGINS` 为空）；跨域前端需配置白名单才能带 cookie。

## 短信 / 微信登录 404

登录页入口还在，后端只有 `POST /auth/rt/login`、`register`、`refresh`、`logout`、`forceLogout`。短信和微信接口不存在。

## `pnpm test` / `pnpm check` 异常

根 `test` 调用 server `test:ci`（`vitest run`）。直接测后端：

```bash
pnpm --filter server test
```

CI 会跑 `pnpm test`。

## `compose.local.yml` Redis

使用 `redis-server --appendonly yes`，数据在 `./redis/data`。不再挂载 `redis.conf`。Postgres 凭据写死在 compose 里，注意不要和 `apps/server/.env` 冲突。

## 生产 Compose 起不来

常见原因见 [docker.md](../deployment/docker.md)「当前与代码不一致的地方」：健康检查 `/health`、web 镜像 `COPY packages`、server 入口路径、根 `.env` 缺失。

## 地理位置一直是「未知」

登录与审计会尝试离线解析 IP。`ip2region-ts` 未列入依赖时会静默失败，显示「未知」或内网文案，不是数据库坏了。
