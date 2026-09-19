# Web

Vue 3 管理后台，包名 `web`，目录 `apps/web`。详细说明见仓库 [docs/architecture/frontend.md](../../docs/architecture/frontend.md)。

## 本地

```bash
pnpm --filter web dev     # Vite --mode base，端口 4000，/api 代理到 127.0.0.1:3000
pnpm --filter web build   # 等同 build:pro，产出 dist-pro
```

根目录也可用 `pnpm dev:web`。环境文件：`.env.base` / `.env.dev` / `.env.pro`。
