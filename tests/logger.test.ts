import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '@/lib/logger';

function createSink() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('logger', () => {
  it('respeta el nivel mínimo configurado', () => {
    const sink = createSink();
    const logger = createLogger({ nodeEnv: 'development', logLevel: 'warn', sink });

    logger.info('ignored');
    logger.warn('keep');

    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledTimes(1);
  });

  it('serializa errores como JSON en producción', () => {
    const sink = createSink();
    const logger = createLogger({ nodeEnv: 'production', logLevel: 'debug', sink });

    logger.error('boom', { error: new Error('fatal') });

    const payload = JSON.parse(String(sink.error.mock.calls[0]?.[0] ?? '{}')) as {
      level: string;
      context: { error: { message: string; stack?: string } };
    };

    expect(payload.level).toBe('error');
    expect(payload.context.error.message).toBe('fatal');
    expect(payload.context.error.stack).toBeUndefined();
  });
});
