# Docker 部署

编排与镜像的事实来源。生产操作步骤见 [production.md](./production.md)，变量名见 [environment.md](./environment.md)。

## 编排文件

根目录 **`compose.yml`**（另有 `compose.local.yml`，只起本机 Postgres/Redis，并映射宿主机端口，不用于生产）。

| 服务     | 镜像/构建                            | 说明                                                                                          |
| -------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| postgres | postgres:18-alpine                   | 卷 `postgres-data`；挂载 `docker/postgres/init-users.sh` 初始化管理/迁移/运行账号             |
| redis    | redis:8-alpine                       | 密码 + AOF；卷 `redis-data`                                                                   |
| migrate  | server Dockerfile `target: migrator` | 一次性：`migrate deploy && db seed`，成功后退出                                               |
| server   | server Dockerfile `target: runner`   | 健康检查当前探测 `GET /health`；bind mount `./data/server/public`、`./data/server/backups`    |
| admin    | `apps/web/Dockerfile`                | Nginx 托管 SPA；依赖 server healthy                                                           |

启动顺序：postgres/redis healthy → migrate 成功退出 → server / admin。

### 网络与端口

- 外部网络名 **`shared_net`**（`external: true`），给 Nginx Proxy Manager 等接入。
- 宿主机需先执行：`docker network create shared_net`
- **不映射宿主机 ports**。对外只应让 NPM 访问 `admin:80`；`/api` 由 admin 容器内 Nginx 转到 `server:3000`。

### 当前与代码不一致的地方（部署前需处理）

1. Server 健康检查访问 `GET /health`，应用只有受 JWT 保护的 `GET /`，容器会一直 unhealthy，`admin` 因 `service_healthy` 起不来。
2. `apps/web/Dockerfile` 仍 `COPY packages packages/`，仓库没有 `packages/`，构建会失败。
3. Server runner `CMD` 为 `node dist/src/main.js`，`start:prod` 与 `tsconfig.build.json` 的 `rootDir` 指向 `dist/main.js`，入口路径需要以实际 `nest build` 产物为准。
4. 根目录没有 `.env.example`，也没有 `scripts/generate-production-env.mjs`；`compose.yml` 又要求根 `.env` 提供全部必填插值。
5. Server 只挂载 `public`、`backups`，**没有** logs bind mount。
6. `compose.local.yml` 引用 `./redis/redis.conf`，仓库中不存在该文件。

## Dockerfile 要点

### server（`apps/server/Dockerfile`）

1. **builder**：`HUSKY=0` + `verify-deps-before-run=false`，`pnpm --filter server...` 安装，再 `prisma generate` + `nest build`
2. **migrator**：继承 builder，跑迁移与 seed
3. **runner**：alpine 生产依赖；安装 `postgresql18-client` 供 `pg_dump`；`USER node`（uid 1000）；EXPOSE 3000

`COPY packages` 在 server Dockerfile 里已经注释。

### admin（`apps/web/Dockerfile`）

1. **builder**：只装 web 依赖后 `build:pro`，产出 `apps/web/dist-pro`
2. **runtime**：`nginx:1.31-alpine`，拷贝 `dist-pro` 与 **`docker/nginx/nginx.conf`** → `/etc/nginx/conf.d/default.conf`
3. `NODE_OPTIONS=--max-old-space-size=1024`（注释仍写 2GB）

## admin Nginx（`docker/nginx/nginx.conf`）

- SPA：`try_files` → `index.html`
- `location ^~ /api/` → `proxy_pass http://server:3000/`（去掉 `/api` 前缀）
- WebSocket：`Upgrade` / `Connection`；读写超时 3600s；`client_max_body_size 20m`
- 转发头：`X-Real-IP` 来自请求的 `X-Real-IP`（空则 `$remote_addr`）；`X-Forwarded-Proto` 透传客户端值。当前配置**没有** `set_real_ip_from` / `real_ip_header`
- CSP：`script-src 'self' 'unsafe-inline' 'unsafe-eval'`

热更新正在跑的容器（配置在宿主机改完后）：

```bash
docker cp docker/nginx/nginx.conf app-admin:/etc/nginx/conf.d/default.conf
docker exec app-admin nginx -t
docker exec app-admin nginx -s reload
```

## 其它

- `.dockerignore`：排除 node_modules、多数 `.env`、测试等；放行 `apps/web/.env.*`
- 空数据卷首次 initdb 会跑 `docker/postgres/init-users.sh`。已有卷补用户见 `docker/postgres/migrate-existing-users.sql`
- 备份、上传目录必须是宿主机 bind mount，且属主为 uid 1000：

```bash
mkdir -p data/server/{public,backups}
chown -R 1000:1000 data/server
```

- 数据库备份由 server 内 BullMQ 执行；环境变量见 [environment.md](./environment.md)
- CI（`.github/workflows/ci.yml`）跑 `pnpm lint && pnpm typecheck && pnpm build`，不构建/推送镜像，也不跑测试
