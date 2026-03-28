type RuntimeMode = 'development' | 'test' | 'production';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppEnv = {
  NODE_ENV: RuntimeMode;
  DATABASE_URL: string;
  AUTH_SECRET: string;
  LOG_LEVEL: LogLevel;
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
    LOG_LEVEL: parseLogLevel(source.LOG_LEVEL, nodeEnv),
  };
}

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (source === process.env) {
    cachedEnv ??= getValidatedEnv(source);
    return cachedEnv;
  }

  return getValidatedEnv(source);
}
