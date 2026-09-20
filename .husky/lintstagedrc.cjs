module.exports = {
  'apps/server/**/*.ts': () => 'pnpm --filter server lint:check',
  'apps/web/**/*.{vue,ts,tsx,js,cjs}': () => 'pnpm --filter web lint:check',
}
