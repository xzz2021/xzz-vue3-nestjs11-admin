# 生产部署指南

操作清单。镜像/网络细节见 [docker.md](./docker.md)，变量见 [environment.md](./environment.md)。

当前 Compose / Dockerfile 与应用代码有几处不一致，按本文操作前请先看 [docker.md](./docker.md) 的「当前与代码不一致的地方」。未处理时 `docker compose up` 可能无法完成。

## 前置

1. 环境变量：自行在仓库根创建 `.env`（没有可复制的根 `.env.example`，也没有 `pnpm env:generate`）。必须包含 Compose 必填项，以及 **`PG_DATABASE_URL`（迁移账号）和 `APP_DATABASE_URL`（运行账号）**。
2. 数据目录（与镜像内 `node` uid **1000** 对齐，否则备份/上传会 EACCES）：

   ```bash
   mkdir -p data/server/{public,backups}
   chown -R 1000:1000 data/server
   ```

3. 外部网络（名称必须与 `compose.yml` 一致）：

   ```bash
   docker network create shared_net
   ```

   Nginx Proxy Manager 必须加入该网络。

4. Git 换行：仓库文件为 LF。不要在文档里要求修改全局 git config；按本机 Git 设置处理即可。

## 启动

```bash
docker compose -f compose.yml up -d --build
```

postgres/redis healthy → migrate 一次成功退出 → server、admin。

## 反代（推荐拓扑）

Compose **不对外暴露端口**。浏览器只打到 NPM，NPM 只反代 **admin**：

```
浏览器 → NPM（shared_net）→ http://admin:80
                              ├─ 静态 SPA
                              └─ /api/* → server:3000（admin Nginx 去掉 /api）
```

| NPM Proxy Host | 值                                                                 |
| -------------- | ------------------------------------------------------------------ |
| Forward        | `http://admin:80`                                                  |
| Websockets     | 开启                                                               |
| 真实 IP        | 开启 Websockets。admin Nginx 当前透传 `X-Real-IP` / `X-Forwarded-Proto`，没有 Docker 私网信任边界 |

生产前端 `VITE_API_BASE_PATH=/api/`（`.env.pro`）。请求与页面同源，由 admin Nginx 处理 `/api`，**不要**再为同一域名把 `/api` 指到 `server:3000`。

可选替代（与推荐互斥）：NPM 将 `/` 指 `admin:80`、将 `/api` 直连 `server:3000` 并去掉前缀。此时须在 NPM 上单独开 Websockets，且不要再让 `/api` 进入 admin Nginx。

WebSocket 路径：`/api/online/ws`、`/api/message/ws`、`/api/monitor/ws`。

## 安全清单

- `SWAGGER=false`
- `HELMET=true`
- Postgres 三个角色密码互不相同（需人工保证，脚本不校验）
- Token / Redis 使用高熵随机值
- 不映射宿主机端口，只经受控反代
- 生产不要使用 `apps/server/.env.example` 里的示例密钥和超大 Token 秒数

## 更新与维护

```bash
docker compose -f compose.yml up -d --build   # 代码更新后重建
docker compose run --rm migrate                 # 仅迁移+seed
docker compose down                             # 停服务保留卷
```

热更新 Nginx：见 [docker.md](./docker.md)（文件是 `docker/nginx/nginx.conf`，容器名 `app-admin`）。

Prisma 7 使用 Node 24 镜像（与 `apps/server/Dockerfile` 的 `node:24.18` 一致）。

## CI

`.github/workflows/ci.yml`：install → `pnpm lint && pnpm typecheck && pnpm build`。无测试、无自动部署。
