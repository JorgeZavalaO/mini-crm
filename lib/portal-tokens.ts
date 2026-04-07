import { createHash, randomBytes } from 'node:crypto';

export const PORTAL_TOKEN_TTL_DAYS = 30;

export type PortalTokenLike = {
  isActive: boolean;
  expiresAt: Date | null;
};

export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPortalToken() {
  const rawToken = randomBytes(32).toString('hex');

  return {
    rawToken,
    tokenHash: hashPortalToken(rawToken),
  };
}

export function getPortalTokenExpiresAt(from = new Date()) {
  return new Date(from.getTime() + PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isPortalTokenActive(portalToken: PortalTokenLike, now = new Date()) {
  if (!portalToken.isActive) return false;
  // Tokens without an expiry date are considered invalid (expired/unsafe)
  if (!portalToken.expiresAt) return false;
  return portalToken.expiresAt.getTime() > now.getTime();
}
