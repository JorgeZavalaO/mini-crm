import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildSecurityHeaders } from '@/lib/http-security';
import { logger } from '@/lib/logger';

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
export const proxy = auth(async (req) => {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  try {
    const { pathname } = req.nextUrl;
    const session = req.auth;
    const isLoggedIn = Boolean(session?.user);
    const user = session?.user ?? null;

    if (pathname === '/register') {
      return finalizeResponse(
        req,
        NextResponse.redirect(new URL('/login', req.nextUrl)),
        requestId,
      );
    }

    const isPublicRoute =
      pathname === '/' ||
      pathname === '/login' ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/portal');

    if (isLoggedIn && pathname === '/login') {
      const dest = user?.tenantSlug
        ? `/${user.tenantSlug}/dashboard`
        : user?.isSuperAdmin
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

      if (!user?.isSuperAdmin) {
        const dest = user?.tenantSlug ? `/${user.tenantSlug}/dashboard` : '/login';
        return finalizeResponse(req, NextResponse.redirect(new URL(dest, req.nextUrl)), requestId);
      }

      return finalizeResponse(req, NextResponse.next(), requestId);
    }

    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.nextUrl);
      // Guard against protocol-relative or absolute URLs injected into the path (B-01)
      const safePath = /^\/[^/]/.test(pathname) ? pathname : '/';
      loginUrl.searchParams.set('callbackUrl', safePath);
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
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
