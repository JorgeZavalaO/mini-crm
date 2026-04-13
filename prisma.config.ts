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
    // DIRECT_URL apunta a la conexión directa de Neon (sin pooler) y es requerida
    // en entornos como Vercel para que `prisma migrate deploy` pueda adquirir
    // advisory locks (pg_advisory_lock). Sin ella, PgBouncer en modo transacción
    // bloquea los locks de sesión y el comando falla con P1002.
    url: process.env.DIRECT_URL ?? appEnv.DATABASE_URL,
  },
});
