export type SecurityHeaderOptions = {
  isHttps?: boolean;
  requestId?: string;
};

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
