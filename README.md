### 项目说明

这是一个使用 pnpm 的 monorepo：前端基于 [vue-element-plus-admin](https://github.com/kailong321200875/vue-element-plus-admin) + Vite 8 改造，目录为 `apps/web`；后端为 NestJS 12 + Prisma 7 + PostgreSQL + Redis，目录为 `apps/server`。

生产意图是经 `compose.yml` + 外部反代部署。当前镜像/健康检查与代码仍有不一致，详见 [docs/deployment/docker.md](./docs/deployment/docker.md)。技术文档入口：[docs/README.md](./docs/README.md)。

**前置要求**

- 本地开发：pnpm 11、Git、PostgreSQL、Redis、Node 24.x
- 服务器部署：Git、Docker
