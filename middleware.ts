import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware de protección de rutas.
 *
 * Rutas:
 *   /login, /register, /api/auth/** → público
 *   /superadmin/**                  → requiere isSuperAdmin
 *   /{tenantSlug}/**                → requiere sesión (la validación fina de membership
 *                                     se hace en el layout de [tenantSlug], que tiene acceso a DB)
 *   /                               → redirige según sesión
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;

  // ── Rutas públicas ──────────────────────────────────────
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/api/auth');

  // Logged-in user trying to access login/register → redirect to their tenant
  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    const dest = token.tenantSlug
      ? `/${token.tenantSlug}/dashboard`
      : token.isSuperAdmin
        ? '/superadmin'
        : '/login';
    return NextResponse.redirect(new URL(dest, req.nextUrl));
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // ── SuperAdmin ──────────────────────────────────────────
  if (pathname.startsWith('/superadmin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.nextUrl));
    }
    if (!token.isSuperAdmin) {
      const dest = token.tenantSlug ? `/${token.tenantSlug}/dashboard` : '/login';
      return NextResponse.redirect(new URL(dest, req.nextUrl));
    }
    return NextResponse.next();
  }

  // ── Todas las demás rutas (/{tenantSlug}/**) ────────────
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
