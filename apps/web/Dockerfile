FROM node:24.18 AS builder

WORKDIR /app

# 镜像内无 .git：跳过 husky。pnpm 11 默认 verifyDepsBeforeRun=install，
# COPY 全仓后执行脚本会把 server/prisma 再装一遍，这里关掉。
ENV HUSKY=0

RUN npm i -g pnpm@11.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/
COPY packages packages/

# 切换 pnpm 源为镜像源
RUN pnpm config set registry https://registry.npmmirror.com \
  && pnpm config set verify-deps-before-run false

# 使用 BuildKit 缓存 pnpm store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,sharing=locked \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile --filter admin...

COPY . .

# 限制 Node 进程的最大内存使用为 2GB（根据你的服务器内存调整，如 1024 / 2048 / 4096）
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN pnpm --filter admin build:pro

FROM nginx:1.31-alpine

COPY --from=builder /app/apps/admin/dist-pro /usr/share/nginx/html

COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx","-g","daemon off;"]

# -------------------服务器内容太小,手动build再上传-----------

#   # 极简 Dockerfile 示例
# FROM nginx:1.31-alpine
# COPY apps/admin/dist-pro /usr/share/nginx/html
# EXPOSE 80
