import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import prismaConfig from '../prisma.config';

describe('prisma config migration', () => {
  it('centraliza schema, migrations y datasource en prisma.config.ts', () => {
    expect(prismaConfig).toMatchObject({
      schema: 'prisma/schema.prisma',
      migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
      },
    });

    const rawConfigFile = readFileSync(new URL('../prisma.config.ts', import.meta.url), 'utf8');

    expect(rawConfigFile).toContain('datasource:');
    expect(rawConfigFile).toContain('getValidatedEnv(process.env)');
    expect(rawConfigFile).toContain('url: appEnv.DATABASE_URL');
  });
});
