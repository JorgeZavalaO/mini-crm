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
    expect(result.AUTH_TRUST_HOST).toBe(false);
    expect(result.AUTH_RATE_LIMIT_WINDOW_MS).toBe(600000);
    expect(result.AUTH_RATE_LIMIT_MAX_ATTEMPTS).toBe(5);
    expect(result.AUTH_RATE_LIMIT_BLOCK_MS).toBe(900000);
  });

  it('desactiva AUTH_TRUST_HOST por defecto en producción y acepta override valido', () => {
    const defaultProd = getValidatedEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://demo',
      AUTH_SECRET: '12345678901234567890123456789012',
    } as NodeJS.ProcessEnv);

    const overriddenProd = getValidatedEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://demo',
      AUTH_SECRET: '12345678901234567890123456789012',
      AUTH_TRUST_HOST: 'true',
    } as NodeJS.ProcessEnv);

    expect(defaultProd.AUTH_TRUST_HOST).toBe(false);
    expect(overriddenProd.AUTH_TRUST_HOST).toBe(true);
  });

  it('rechaza AUTH_TRUST_HOST no booleano', () => {
    expect(() =>
      getValidatedEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://demo',
        AUTH_TRUST_HOST: 'maybe',
      } as NodeJS.ProcessEnv),
    ).toThrow('AUTH_TRUST_HOST debe ser true o false');
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

  it('valida que la configuracion de rate limit sea numerica y positiva', () => {
    expect(() =>
      getValidatedEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://demo',
        AUTH_RATE_LIMIT_MAX_ATTEMPTS: '0',
      } as NodeJS.ProcessEnv),
    ).toThrow('AUTH_RATE_LIMIT_MAX_ATTEMPTS debe ser un entero mayor o igual a 1');
  });
});
