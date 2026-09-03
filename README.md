### 项目说明

这是一个使用pnpm进行包管理的monorepo仓库, 前端基于 [vue-element-plus-admin
](https://github.com/kailong321200875/vue-element-plus-admin) + vite8 及其他重要依赖的最新版重新整合搭建, 后端采用 nest cli 生成的官方代码, 配合 prisma8 + postgres 实现整体服务, 最后通过 [deploy.sh](./deploy.sh) 脚本实现自动拉取github仓库最新代码, 借助 docker compose 自动构建打包编译和部署上线.

**前置要求**
本地开发时: pnpm git postgres redis node:24.x
服务器部署: git docker
