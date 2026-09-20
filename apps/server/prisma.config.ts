import { loadAppEnv } from './src/core/load-env.js';
import { defineConfig, env } from 'prisma/config';

loadAppEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/seed.ts',
  },
  datasource: {
    url: env('PG_DATABASE_URL'),
  },
});
