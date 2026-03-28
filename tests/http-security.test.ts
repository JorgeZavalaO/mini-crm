import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '@/lib/http-security';

describe('http security headers', () => {
  it('incluye headers base y request id', () => {
    const headers = buildSecurityHeaders({ requestId: 'req-123' });

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-request-id']).toBe('req-123');
  });

  it('solo agrega HSTS cuando la conexión es https', () => {
    expect(buildSecurityHeaders({ isHttps: false })['strict-transport-security']).toBeUndefined();
    expect(buildSecurityHeaders({ isHttps: true })['strict-transport-security']).toContain(
      'max-age=63072000',
    );
  });
});
