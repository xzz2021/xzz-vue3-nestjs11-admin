# Server 启动前完整门禁

## 目标

`dev` / `start` / `start:dev` / `start:debug` 启动前必须通过 lint + typecheck（含 spec）+ test；任一失败则不启动。oxlint warning 暂不导致失败。

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
| `typecheck` | `tsc --noEmit -p tsconfig.build.json`（排除 `*.spec.ts`，供构建/CI） |
| `typecheck:all` | `tsc --noEmit -p tsconfig.json`（含 spec，能扫到错误 import） |
| `test:ci` | `vitest run` |
| `start:prod` | 不挂 preflight（跑已构建 `dist`；门禁在 build/CI） |

## 不在范围

- 不修改 `oxlint.json` 规则
- 不批量清理现有 warning
- 不改 root `check` / husky
- watch 热更新不重复跑 preflight（只拦首次启动）

## 预期行为

启用后若 `typecheck:all` 或测试已有失败，启动会被拦住，需先修复再跑。
