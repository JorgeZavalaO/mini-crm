import { describe, expect, it } from 'vitest';
import { createAuthRateLimiter } from '@/lib/auth-rate-limit';

describe('auth rate limit', () => {
  it('bloquea temporalmente la identidad tras exceder el maximo de intentos', () => {
    let now = 0;
    const limiter = createAuthRateLimiter(
      {
        windowMs: 60_000,
        blockMs: 120_000,
        maxAttempts: 3,
        maxAttemptsPerOrigin: 9,
        now: () => now,
      },
      new Map(),
    );

    const context = {
      slug: 'acme-logistics',
      email: 'admin@acme.com',
      ip: '203.0.113.10',
    };

    expect(limiter.getStatus(context).limited).toBe(false);

    limiter.consumeFailure(context);
    limiter.consumeFailure(context);
    const blocked = limiter.consumeFailure(context);

    expect(blocked.limited).toBe(true);
    expect(blocked.scope).toBe('identity');
    expect(blocked.retryAfterMs).toBe(120_000);

    now += 120_001;
    expect(limiter.getStatus(context).limited).toBe(false);
  });

  it('reinicia el contador luego de un login exitoso', () => {
    const limiter = createAuthRateLimiter(
      {
        windowMs: 60_000,
        blockMs: 120_000,
        maxAttempts: 3,
        maxAttemptsPerOrigin: 9,
        now: () => 0,
      },
      new Map(),
    );

    const context = {
      slug: 'acme-logistics',
      email: 'admin@acme.com',
      ip: '203.0.113.10',
    };

    limiter.consumeFailure(context);
    limiter.consumeFailure(context);
    limiter.reset(context);

    expect(limiter.getStatus(context)).toEqual({
      limited: false,
      scope: null,
      retryAfterMs: 0,
    });
  });
});
