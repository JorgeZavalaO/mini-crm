import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { getValidatedEnv } from './lib/env';

const appEnv = getValidatedEnv(process.env);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: appEnv.DATABASE_URL,
  },
});
