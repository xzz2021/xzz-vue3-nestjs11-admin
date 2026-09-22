# Server 启动前完整门禁

## 目标

`dev` / `start` / `start:dev` / `start:debug` 启动前必须通过 lint + typecheck（含 spec）+ test；任一失败则不启动。oxlint warning 暂不导致失败。

Husky / CI 使用同一套质量门禁，避免仅本地启动才拦住。

## 方案

在 `apps/server/package.json` 增加 `preflight`，由启动脚本前置调用：

```text
preflight = lint:check && typecheck:all && test:ci
dev / start / start:dev / start:debug = preflight && nest start …
```

## 脚本约定

| 脚本 | 行为 |
|------|------|
| `lint:check` | `oxlint src/ test/`（不使用 `--deny-warnings`） |
| `typecheck` | `tsc --noEmit -p tsconfig.build.json`（排除 `*.spec.ts`，供构建） |
| `typecheck:all` | `tsc --noEmit -p tsconfig.json`（含 spec，能扫到错误 import） |
| `test:ci` | `vitest run` |
| `start:prod` | 不挂 preflight（跑已构建 `dist`；门禁在 build/CI） |

## Root / Husky / CI

| 入口 | 行为 |
|------|------|
| root `typecheck` | server `typecheck:all` + web `typecheck` |
| root `check` | lint + typecheck + test + build |
| root `preflight:server` | 仅 server preflight |
| husky `pre-commit` | lint-staged：server 变更 → `preflight`；web 变更 → `lint:check` |
| husky `pre-push` | `pnpm check` |
| CI | `pnpm check` |

## 不在范围

- 不修改 `oxlint.json` 规则
- 不批量清理现有 warning
- watch 热更新不重复跑 preflight（只拦首次启动）

## 预期行为

启用后若 `typecheck:all` 或测试已有失败，启动 / commit（触及 server）/ push / CI 都会被拦住，需先修复再继续。
