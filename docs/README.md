# 项目技术文档

基于 NestJS 12 + Prisma 7 + PostgreSQL + Redis + Vue 3 的后台管理系统（pnpm monorepo）。

前端包名与目录是 **`apps/web`**。Compose 里的容器服务名仍叫 **`admin`**，只表示「管理后台镜像」，不要和源码路径混淆。

## 文档导航

| 分类     | 文档                                                                                                                                                                | 说明            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 架构     | [system-design](./architecture/system-design.md)                                                                                                                    | 系统架构总览    |
|          | [backend](./architecture/backend.md)                                                                                                                                | 后端模块与分层  |
|          | [frontend](./architecture/frontend.md)                                                                                                                              | 前端结构与路由  |
|          | [permission](./architecture/permission.md)                                                                                                                          | RBAC 权限设计   |
|          | [data-flow](./architecture/data-flow.md)                                                                                                                            | 关键数据流      |
| 数据库   | [database-design](./database/database-design.md)                                                                                                                    | 表结构与关系    |
|          | [prisma-guide](./database/prisma-guide.md)                                                                                                                          | Prisma 使用说明 |
| 业务模块 | [auth](./modules/auth.md) / [user](./modules/user.md) / [role](./modules/role.md) / [permission](./modules/permission.md) / [customer](./modules/customer.md)       | 核心业务        |
|          | [oss](./modules/oss.md) / [db-backup](./modules/db-backup.md)                                                                                                       | 对象存储与备份  |
| API      | [api-overview](./api/api-overview.md) / [authentication](./api/authentication.md)                                                                                   | 接口与鉴权      |
| 部署     | [docker](./deployment/docker.md) / [environment](./deployment/environment.md) / [production](./deployment/production.md)                                            | Docker 与生产   |
| 开发     | [local-development](./development/local-development.md) / [coding-standard](./development/coding-standard.md) / [extension-guide](./development/extension-guide.md) | 本地开发与扩展  |
| 其他     | [common-problems](./troubleshooting/common-problems.md) / [code-map](./code-map.md)                                                                                 | 排障与代码地图  |

## 仓库结构（简要）

```
xzz-vue3-nestjs11-admin/
├── apps/
│   ├── web/            # Vue 3 管理后台（包名 web）
│   └── server/         # NestJS API（包名 server）
├── docker/
│   ├── nginx/          # admin 容器 Nginx 配置
│   └── postgres/       # Postgres 初始化脚本
├── compose.yml         # 生产编排
├── compose.local.yml   # 仅本机 Postgres/Redis（不用于生产）
└── docs/               # 本目录
```

`pnpm-workspace.yaml` 仍声明 `packages/*`，当前仓库没有共享包目录。

## 技术栈

| 层       | 技术                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| 前端     | Vue 3.5、TypeScript 6、Vite 8、Element Plus 2.14、Pinia 4、Vue Router 5、UnoCSS |
| 后端     | NestJS 12、Prisma 7.10、Passport JWT、Zod、CASL、BullMQ、Winston                  |
| 数据     | PostgreSQL 18、Redis 8                                                            |
| 基础设施 | Docker Compose、Nginx（admin 容器）、pnpm 11 workspace、Node 24                   |

## 快速入口

- 本地开发：见 [local-development](./development/local-development.md)
- Docker 部署：见 [docker](./deployment/docker.md)
- 权限模型：见 [permission](./architecture/permission.md)
- 代码定位：见 [code-map](./code-map.md)
