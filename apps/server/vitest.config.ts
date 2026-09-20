import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '#/prisma/generated': path.join(root, 'src/generated'),
    },
  },
  test: {
    globals: true,
    root: './',
    include: [
      '**/*.spec.ts',
      '../web/src/utils/route-permission.spec.ts',
      '../web/src/axios/auth-refresh.spec.ts',
      '../web/src/store/modules/user.persist.spec.ts',
      '../web/src/hooks/fn/apply-role-routes.spec.ts',
    ],
  },
});
