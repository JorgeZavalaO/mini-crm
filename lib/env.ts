type RuntimeMode = 'development' | 'test' | 'production';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppEnv = {
  NODE_ENV: RuntimeMode;
  DATABASE_URL: string;
  AUTH_SECRET: string;
  AUTH_TRUST_HOST: boolean;
  LOG_LEVEL: LogLevel;
  AUTH_RATE_LIMIT_WINDOW_MS: number;
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: number;
  AUTH_RATE_LIMIT_BLOCK_MS: number;
  BLOB_READ_WRITE_TOKEN: string | undefined;
  RESEND_API_KEY: string | undefined;
  EMAIL_FROM: string | undefined;
};

const FALLBACK_DEV_AUTH_SECRET = 'dev-only-auth-secret-change-me-please-32';
let cachedEnv: AppEnv | null = null;

function parseRuntimeMode(value: string | undefined): RuntimeMode {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function parseLogLevel(value: string | undefined, nodeEnv: RuntimeMode): LogLevel {
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }

  return nodeEnv === 'development' ? 'debug' : 'info';
}

function parseBoolean(value: string | undefined, fallback: boolean, envName: string): boolean {
  if (!value?.trim()) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(`${envName} debe ser true o false`);
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  envName: string,
  min = 1,
) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${envName} debe ser un entero mayor o igual a ${min}`);
  }

  return parsed;
}

export function getValidatedEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = parseRuntimeMode(source.NODE_ENV);
  const databaseUrl = source.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada');
  }

  const rawAuthSecret = source.AUTH_SECRET?.trim();
  if (nodeEnv === 'production' && (!rawAuthSecret || rawAuthSecret.length < 32)) {
    throw new Error('AUTH_SECRET debe existir y tener al menos 32 caracteres en producción');
  }

  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl,
    AUTH_SECRET:
      rawAuthSecret && rawAuthSecret.length >= 32 ? rawAuthSecret : FALLBACK_DEV_AUTH_SECRET,
    AUTH_TRUST_HOST: parseBoolean(source.AUTH_TRUST_HOST, false, 'AUTH_TRUST_HOST'),
    LOG_LEVEL: parseLogLevel(source.LOG_LEVEL, nodeEnv),
    BLOB_READ_WRITE_TOKEN: source.BLOB_READ_WRITE_TOKEN?.trim() || undefined,
    RESEND_API_KEY: source.RESEND_API_KEY?.trim() || undefined,
    EMAIL_FROM: source.EMAIL_FROM?.trim() || undefined,
    AUTH_RATE_LIMIT_WINDOW_MS: parsePositiveInteger(
      source.AUTH_RATE_LIMIT_WINDOW_MS,
      10 * 60 * 1000,
      'AUTH_RATE_LIMIT_WINDOW_MS',
      1_000,
    ),
    AUTH_RATE_LIMIT_MAX_ATTEMPTS: parsePositiveInteger(
      source.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
      5,
      'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
      1,
    ),
    AUTH_RATE_LIMIT_BLOCK_MS: parsePositiveInteger(
      source.AUTH_RATE_LIMIT_BLOCK_MS,
      15 * 60 * 1000,
      'AUTH_RATE_LIMIT_BLOCK_MS',
      1_000,
    ),
  };
}

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (source === process.env) {
    cachedEnv ??= getValidatedEnv(source);
    return cachedEnv;
  }

  return getValidatedEnv(source);
}
