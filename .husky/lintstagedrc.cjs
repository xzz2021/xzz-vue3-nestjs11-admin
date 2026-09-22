module.exports = {
  // server 变更走完整门禁（lint + typecheck:all + test）
  'apps/server/**/*.ts': () => 'pnpm --filter server preflight',
  'apps/web/**/*.{vue,ts,tsx,js,cjs}': () => 'pnpm --filter web lint:check',
}
