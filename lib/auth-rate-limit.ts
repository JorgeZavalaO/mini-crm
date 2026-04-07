import { createHash } from 'node:crypto';
import { getEnv } from '@/lib/env';

export type AuthAttemptContext = {
  slug: string;
  email: string;
  ip?: string | null;
};

export type AuthRateLimitScope = 'identity' | 'origin';

export type AuthRateLimitStatus = {
  limited: boolean;
  scope: AuthRateLimitScope | null;
  retryAfterMs: number;
};

type AttemptRecord = {
  attempts: number;
  windowStartedAt: number;
  blockedUntil: number;
};

type AuthRateLimitConfig = {
  windowMs: number;
  blockMs: number;
  maxAttempts: number;
  maxAttemptsPerOrigin: number;
  now: () => number;
};

const ORIGIN_LIMIT_MULTIPLIER = 3;

type GlobalRateLimitStore = typeof globalThis & {
  __miniCrmAuthRateLimitStore?: Map<string, AttemptRecord>;
};

const MAX_STORE_ENTRIES = 100_000;

function getDefaultStore() {
  const scope = globalThis as GlobalRateLimitStore;
  scope.__miniCrmAuthRateLimitStore ??= new Map<string, AttemptRecord>();
  return scope.__miniCrmAuthRateLimitStore;
}

function evictExpiredIfNeeded(store: Map<string, AttemptRecord>, now: number, windowMs: number) {
  if (store.size < MAX_STORE_ENTRIES) return;
  for (const [key, record] of store) {
    if (
      (record.blockedUntil > 0 && record.blockedUntil <= now) ||
      now - record.windowStartedAt >= windowMs
    ) {
      store.delete(key);
    }
  }
  // Hard-evict oldest entries if still over limit
  if (store.size >= MAX_STORE_ENTRIES) {
    const excess = store.size - MAX_STORE_ENTRIES + 1;
    let evicted = 0;
    for (const key of store.keys()) {
      store.delete(key);
      if (++evicted >= excess) break;
    }
  }
}

function hashKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeContext(context: AuthAttemptContext) {
  return {
    slug: context.slug.trim().toLowerCase(),
    email: context.email.trim().toLowerCase(),
    ip: context.ip?.trim() || null,
  };
}

function resolveConfig(overrides: Partial<AuthRateLimitConfig>): AuthRateLimitConfig {
  if (
    overrides.windowMs !== undefined &&
    overrides.blockMs !== undefined &&
    overrides.maxAttempts !== undefined
  ) {
    return {
      windowMs: overrides.windowMs,
      blockMs: overrides.blockMs,
      maxAttempts: overrides.maxAttempts,
      maxAttemptsPerOrigin:
        overrides.maxAttemptsPerOrigin ?? overrides.maxAttempts * ORIGIN_LIMIT_MULTIPLIER,
      now: overrides.now ?? Date.now,
    };
  }

  const env = getEnv();
  const maxAttempts = overrides.maxAttempts ?? env.AUTH_RATE_LIMIT_MAX_ATTEMPTS;

  return {
    windowMs: overrides.windowMs ?? env.AUTH_RATE_LIMIT_WINDOW_MS,
    blockMs: overrides.blockMs ?? env.AUTH_RATE_LIMIT_BLOCK_MS,
    maxAttempts,
    maxAttemptsPerOrigin: overrides.maxAttemptsPerOrigin ?? maxAttempts * ORIGIN_LIMIT_MULTIPLIER,
    now: overrides.now ?? Date.now,
  };
}

function getRateKeys(context: ReturnType<typeof normalizeContext>, config: AuthRateLimitConfig) {
  const keys: Array<{
    key: string;
    scope: AuthRateLimitScope;
    maxAttempts: number;
  }> = [
    {
      key: hashKey(`identity:${context.slug}:${context.email}`),
      scope: 'identity' as const,
      maxAttempts: config.maxAttempts,
    },
  ];

  if (context.ip) {
    keys.push({
      key: hashKey(`origin:${context.ip}`),
      scope: 'origin' as const,
      maxAttempts: config.maxAttemptsPerOrigin,
    });
  }

  return keys;
}

function getActiveRecord(
  store: Map<string, AttemptRecord>,
  key: string,
  now: number,
  windowMs: number,
) {
  const record = store.get(key);
  if (!record) {
    return null;
  }

  if (
    (record.blockedUntil > 0 && record.blockedUntil <= now) ||
    now - record.windowStartedAt >= windowMs
  ) {
    store.delete(key);
    return null;
  }

  return record;
}

export function createAuthRateLimiter(
  overrides: Partial<AuthRateLimitConfig> = {},
  store = getDefaultStore(),
) {
  function getStatus(context: AuthAttemptContext): AuthRateLimitStatus {
    const normalized = normalizeContext(context);
    const config = resolveConfig(overrides);
    const now = config.now();

    let status: AuthRateLimitStatus = {
      limited: false,
      scope: null,
      retryAfterMs: 0,
    };

    for (const key of getRateKeys(normalized, config)) {
      const record = getActiveRecord(store, key.key, now, config.windowMs);
      if (!record || record.blockedUntil <= now) {
        continue;
      }

      const retryAfterMs = record.blockedUntil - now;
      if (!status.limited || retryAfterMs > status.retryAfterMs) {
        status = {
          limited: true,
          scope: key.scope,
          retryAfterMs,
        };
      }
    }

    return status;
  }

  function consumeFailure(context: AuthAttemptContext): AuthRateLimitStatus {
    const normalized = normalizeContext(context);
    const config = resolveConfig(overrides);
    const now = config.now();
    evictExpiredIfNeeded(store, now, config.windowMs);

    for (const key of getRateKeys(normalized, config)) {
      const record = getActiveRecord(store, key.key, now, config.windowMs) ?? {
        attempts: 0,
        windowStartedAt: now,
        blockedUntil: 0,
      };

      const nextRecord: AttemptRecord = {
        attempts: record.attempts + 1,
        windowStartedAt: record.windowStartedAt,
        blockedUntil: record.blockedUntil,
      };

      if (nextRecord.attempts >= key.maxAttempts) {
        nextRecord.blockedUntil = now + config.blockMs;
      }

      store.set(key.key, nextRecord);
    }

    return getStatus(normalized);
  }

  function reset(context: AuthAttemptContext) {
    const normalized = normalizeContext(context);
    const config = resolveConfig(overrides);

    for (const key of getRateKeys(normalized, config)) {
      store.delete(key.key);
    }
  }

  function clear() {
    store.clear();
  }

  return {
    getStatus,
    consumeFailure,
    reset,
    clear,
  };
}

export const authRateLimiter = createAuthRateLimiter();
