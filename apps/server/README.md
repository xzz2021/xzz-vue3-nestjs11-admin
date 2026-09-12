1. 核心技术栈

- ORM-prisma
- DB-postgres/redis
- AUTH-jwt/casl
- LOG-winston/morgan
- DEPLOY-docker/nginx proxy manager

2. 前置条件:

   > - 准备好数据库postgres(默认需要的数据库名newback)和redis(自定义配置可以参考`src/core/config`或`compose.yml`文件部署)
   > - 执行`pnpm i`安装依赖, 首次使用`npx prisma migrate dev --name init`生成prisma初始迁移记录以及同步数据库表结构, `pnpm prisma generate`首次执行会下载prisma engine,同时自动生成prisma客户端和zod定义的dto, `pnpm prisma:seed`生成数据库初始化数据
   > - 运行 `pnpm prepare` 生成husky
   > - `pnpm dev`启动项目
   > - 打包使用`build:minify`可以减少50%体积

全局zod校验
1.prisma的schema文件使用///注释语法,再通过generater自动生成相应校验及类型定义,各dto文件引用并导出相应class,供其他controller引用,最后在pipe中自定义GlobalZodValidationPipe,由main文件引入生效
