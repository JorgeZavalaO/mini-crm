import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware de protección de rutas.
 *
 * Usa getToken() (puro JWT) para NO importar auth.ts
 * y evitar node:crypto en Edge Runtime.
 *
 * - /login, /register, /api/auth/** → público
 * - /superadmin/**                  → requiere isSuperAdmin
 * - /dashboard/**, /profile/**      → requiere sesión activa
 * - Todo lo demás                   → público
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

  if (isPublicRoute && !(isLoggedIn && (pathname === '/login' || pathname === '/register'))) {
    return NextResponse.next();
  }

  // Si ya está logueado e intenta ir a login/register → dashboard
  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  // ── Rutas protegidas genéricas ──────────────────────────
  const protectedPrefixes = ['/dashboard', '/profile', '/leads'];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── SuperAdmin ──────────────────────────────────────────
  if (pathname.startsWith('/superadmin')) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', req.nextUrl));
    }
    if (!token.isSuperAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except static files and Next.js internals.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
