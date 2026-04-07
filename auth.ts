import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authRateLimiter, type AuthAttemptContext } from '@/lib/auth-rate-limit';
import { db } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { getClientIpFromHeaders } from '@/lib/http-security';
import { logger } from '@/lib/logger';
import { verifyPassword } from '@/lib/password';

const SUPERADMIN_SLUG = 'superadmin';
const appEnv = getEnv();

/**
 * Dummy hash used to ensure constant-time response when the user is not found.
 * Prevents email enumeration via timing difference (A-02).
 * Format: scrypt$<32-hex-salt>$<128-hex-key>
 */
const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function maskEmail(email: string) {
  const [localPart, domainPart] = email.split('@');
  if (!localPart || !domainPart) {
    return '***';
  }

  const visibleLocalPart = localPart.slice(0, 2);
  const hiddenLength = Math.max(1, localPart.length - visibleLocalPart.length);
  return `${visibleLocalPart}${'*'.repeat(hiddenLength)}@${domainPart}`;
}

function serializeAuthContext(context: AuthAttemptContext) {
  return {
    slug: context.slug,
    email: maskEmail(context.email),
    ip: context.ip ?? 'unknown',
  };
}

function rejectAuthorizationAttempt(context: AuthAttemptContext, reason: string) {
  const status = authRateLimiter.consumeFailure(context);
  logger.warn(
    status.limited ? 'Intento de acceso bloqueado por rate limit' : 'Intento de acceso rechazado',
    {
      ...serializeAuthContext(context),
      reason,
      scope: status.scope ?? undefined,
      retryAfterMs: status.retryAfterMs || undefined,
    },
  );

  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: appEnv.AUTH_SECRET,
  trustHost: appEnv.AUTH_TRUST_HOST,
  providers: [
    Credentials({
      credentials: {
        slug: { label: 'Empresa / Plataforma', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const slug = (credentials?.slug as string | undefined)?.trim().toLowerCase();
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const normalizedSlug = slug || SUPERADMIN_SLUG;

        const attemptContext: AuthAttemptContext = {
          slug: normalizedSlug,
          email,
          ip: getClientIpFromHeaders(request.headers),
        };

        const rateLimitStatus = authRateLimiter.getStatus(attemptContext);
        if (rateLimitStatus.limited) {
          logger.warn('Intento de acceso bloqueado por rate limit', {
            ...serializeAuthContext(attemptContext),
            scope: rateLimitStatus.scope ?? undefined,
            retryAfterMs: rateLimitStatus.retryAfterMs,
          });
          return null;
        }

        try {
          const user = await db.user.findUnique({ where: { email } });
          if (!user) {
            // Run scrypt anyway to prevent email enumeration via timing (A-02)
            await verifyPassword(password, DUMMY_HASH);
            return rejectAuthorizationAttempt(attemptContext, 'user_not_found');
          }

          const valid = await verifyPassword(password, user.password);
          if (!valid) return rejectAuthorizationAttempt(attemptContext, 'invalid_password');

          // ── Acceso al panel superadmin ───────────────────────────
          if (normalizedSlug === SUPERADMIN_SLUG) {
            if (!user.isSuperAdmin) {
              return rejectAuthorizationAttempt(attemptContext, 'superadmin_forbidden');
            }

            authRateLimiter.reset(attemptContext);
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              isSuperAdmin: true,
              tenantId: null,
              tenantSlug: null,
              role: null,
            };
          }

          // ── Acceso a cuenta empresa ──────────────────────────────
          const tenant = await db.tenant.findUnique({
            where: { slug: normalizedSlug },
            select: { id: true, slug: true, isActive: true, deletedAt: true },
          });

          if (!tenant || !tenant.isActive || tenant.deletedAt) {
            return rejectAuthorizationAttempt(attemptContext, 'tenant_unavailable');
          }

          const membership = await db.membership.findUnique({
            where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
            select: { role: true, isActive: true, tenantId: true },
          });

          if (!membership || !membership.isActive) {
            return rejectAuthorizationAttempt(attemptContext, 'membership_unavailable');
          }

          authRateLimiter.reset(attemptContext);

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            isSuperAdmin: user.isSuperAdmin,
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            role: membership.role,
          };
        } catch (error) {
          logger.error('Error inesperado durante authorize()', {
            ...serializeAuthContext(attemptContext),
            error,
          });
          return null;
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.isSuperAdmin = (user.isSuperAdmin as boolean) ?? false;
        token.tenantId = (user.tenantId as string | null) ?? null;
        token.tenantSlug = (user.tenantSlug as string | null) ?? null;
        token.role = (user.role as string | null) ?? null;
      }

      // Programmatic session update (e.g. tenant switch)
      // Only allow non-sensitive fields to be updated from the client.
      // Privileged claims (role, isSuperAdmin) are ignored from the client
      // and must be refreshed by signing out and back in.
      if (trigger === 'update' && session) {
        if (session.tenantId !== undefined) token.tenantId = session.tenantId;
        if (session.tenantSlug !== undefined) token.tenantSlug = session.tenantSlug;
        // Do NOT accept role or isSuperAdmin from client to prevent privilege escalation
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.isSuperAdmin = token.isSuperAdmin as boolean;
      session.user.tenantId = token.tenantId as string | null;
      session.user.tenantSlug = token.tenantSlug as string | null;
      session.user.role = token.role as string | null;
      return session;
    },
  },
});
