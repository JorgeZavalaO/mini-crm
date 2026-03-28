import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { buildSecurityHeaders } from '@/lib/http-security';
import { logger } from '@/lib/logger';

const appEnv = getEnv();

function applySecurityHeaders(request: NextRequest, response: NextResponse, requestId: string) {
  const isHttps =
    request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

  const securityHeaders = buildSecurityHeaders({ isHttps, requestId });
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function finalizeResponse(request: NextRequest, response: NextResponse, requestId: string) {
  return applySecurityHeaders(request, response, requestId);
}

/**
 * Proxy de protección de rutas.
 *
 * Rutas:
 *   /login, /register, /api/auth/** → público
 *   /superadmin/**                  → requiere isSuperAdmin
 *   /{tenantSlug}/**                → requiere sesión (la validación fina de membership
 *                                     se hace en el layout de [tenantSlug], que tiene acceso a DB)
 *   /                               → redirige según sesión
 */
export async function proxy(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  try {
    const { pathname } = req.nextUrl;
    const token = await getToken({ req, secret: appEnv.AUTH_SECRET });
    const isLoggedIn = !!token;

    if (pathname === '/register') {
      return finalizeResponse(
        req,
        NextResponse.redirect(new URL('/login', req.nextUrl)),
        requestId,
      );
    }

    const isPublicRoute =
      pathname === '/' || pathname === '/login' || pathname.startsWith('/api/auth');

    if (isLoggedIn && pathname === '/login') {
      const dest = token.tenantSlug
        ? `/${token.tenantSlug}/dashboard`
        : token.isSuperAdmin
          ? '/superadmin'
          : '/login';
      return finalizeResponse(req, NextResponse.redirect(new URL(dest, req.nextUrl)), requestId);
    }

    if (isPublicRoute) {
      return finalizeResponse(req, NextResponse.next(), requestId);
    }

    if (pathname.startsWith('/superadmin')) {
      if (!isLoggedIn) {
        return finalizeResponse(
          req,
          NextResponse.redirect(new URL('/login', req.nextUrl)),
          requestId,
        );
      }

      if (!token.isSuperAdmin) {
        const dest = token.tenantSlug ? `/${token.tenantSlug}/dashboard` : '/login';
        return finalizeResponse(req, NextResponse.redirect(new URL(dest, req.nextUrl)), requestId);
      }

      return finalizeResponse(req, NextResponse.next(), requestId);
    }

    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.nextUrl);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return finalizeResponse(req, NextResponse.redirect(loginUrl), requestId);
    }

    return finalizeResponse(req, NextResponse.next(), requestId);
  } catch (error) {
    logger.error('Fallo inesperado en proxy()', {
      pathname: req.nextUrl.pathname,
      requestId,
      error,
    });

    return finalizeResponse(req, NextResponse.redirect(new URL('/login', req.nextUrl)), requestId);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
