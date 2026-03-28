export type SecurityHeaderOptions = {
  isHttps?: boolean;
  requestId?: string;
};

export type HeadersLike = Pick<Headers, 'get'>;

export function getClientIpFromHeaders(headers: HeadersLike) {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);

    if (firstIp) {
      return firstIp;
    }
  }

  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    headers.get('x-vercel-forwarded-for') ??
    null
  );
}

export function buildSecurityHeaders({ isHttps = false, requestId }: SecurityHeaderOptions = {}) {
  const headers: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'x-dns-prefetch-control': 'off',
  };

  if (requestId) {
    headers['x-request-id'] = requestId;
  }

  if (isHttps) {
    headers['strict-transport-security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}
