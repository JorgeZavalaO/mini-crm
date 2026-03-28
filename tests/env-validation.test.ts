import { describe, expect, it } from 'vitest';
import { getValidatedEnv } from '@/lib/env';

describe('env validation', () => {
  it('requiere DATABASE_URL siempre', () => {
    expect(() =>
      getValidatedEnv({
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv),
    ).toThrow('DATABASE_URL no está configurada');
  });

  it('usa fallback de AUTH_SECRET fuera de producción', () => {
    const result = getValidatedEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://demo',
    } as NodeJS.ProcessEnv);

    expect(result.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(result.LOG_LEVEL).toBe('debug');
  });

  it('exige AUTH_SECRET robusto en producción', () => {
    expect(() =>
      getValidatedEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://demo',
        AUTH_SECRET: 'short-secret',
      } as NodeJS.ProcessEnv),
    ).toThrow('AUTH_SECRET debe existir y tener al menos 32 caracteres en producción');
  });
});
