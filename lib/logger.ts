export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

type LoggerSink = Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;

type LoggerConfig = {
  nodeEnv?: 'development' | 'test' | 'production';
  logLevel?: LoggerLevel;
  sink?: LoggerSink;
};

const LOG_LEVEL_PRIORITY: Record<LoggerLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveNodeEnv(value: string | undefined): 'development' | 'test' | 'production' {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function resolveLogLevel(
  value: string | undefined,
  nodeEnv: 'development' | 'test' | 'production',
) {
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }

  return nodeEnv === 'development' ? 'debug' : 'info';
}

function serializeValue(value: unknown, nodeEnv: 'development' | 'test' | 'production'): unknown {
  if (value instanceof Error) {
    const base = {
      name: value.name,
      message: value.message,
    } as Record<string, unknown>;

    const maybeStatus = (value as { status?: number }).status;
    const maybeCode = (value as { code?: string }).code;

    if (typeof maybeStatus === 'number') {
      base.status = maybeStatus;
    }

    if (typeof maybeCode === 'string') {
      base.code = maybeCode;
    }

    if (nodeEnv !== 'production') {
      base.stack = value.stack;
    }

    return base;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry, nodeEnv));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeValue(entry, nodeEnv)]),
    );
  }

  return value;
}

function normalizeLogArgs(args: unknown[], nodeEnv: 'development' | 'test' | 'production') {
  const [first, ...rest] = args;

  if (typeof first === 'string') {
    if (rest.length === 0) {
      return { message: first, context: undefined as unknown };
    }

    if (rest.length === 1) {
      return { message: first, context: serializeValue(rest[0], nodeEnv) };
    }

    return { message: first, context: serializeValue(rest, nodeEnv) };
  }

  return {
    message: 'Log event',
    context: serializeValue(args, nodeEnv),
  };
}

export function createLogger(config: LoggerConfig = {}) {
  const nodeEnv = config.nodeEnv ?? resolveNodeEnv(process.env.NODE_ENV);
  const logLevel = config.logLevel ?? resolveLogLevel(process.env.LOG_LEVEL, nodeEnv);
  const sink = config.sink ?? console;

  function shouldLog(level: LoggerLevel) {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[logLevel];
  }

  function write(level: LoggerLevel, ...args: unknown[]) {
    if (!shouldLog(level)) {
      return;
    }

    const { message, context } = normalizeLogArgs(args, nodeEnv);
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context !== undefined ? { context } : {}),
    };

    if (nodeEnv === 'production') {
      sink[level](JSON.stringify(payload));
      return;
    }

    if (context === undefined) {
      sink[level](`[${payload.timestamp}] [${level}] ${message}`);
      return;
    }

    sink[level](`[${payload.timestamp}] [${level}] ${message}`, context);
  }

  return {
    debug: (...args: unknown[]) => write('debug', ...args),
    info: (...args: unknown[]) => write('info', ...args),
    warn: (...args: unknown[]) => write('warn', ...args),
    error: (...args: unknown[]) => write('error', ...args),
  };
}

export const logger = createLogger();
