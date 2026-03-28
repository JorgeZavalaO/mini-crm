'use server';

import { headers } from 'next/headers';
import { signIn } from '@/auth';
import { authRateLimiter } from '@/lib/auth-rate-limit';
import { getClientIpFromHeaders } from '@/lib/http-security';
import { AuthError } from 'next-auth';

const SUPERADMIN_SLUG = 'superadmin';
const GENERIC_LOGIN_ERROR =
  'No se pudo iniciar sesion. Verifica tus credenciales o el acceso al panel.';
const RATE_LIMIT_LOGIN_ERROR =
  'Demasiados intentos de acceso. Espera unos minutos antes de volver a intentar.';

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const slug = (formData.get('slug') as string | null)?.trim().toLowerCase();
  const email = (formData.get('email') as string | null)?.trim().toLowerCase();
  const password = (formData.get('password') as string | null) ?? '';

  if (!email || !password) {
    return { error: 'Email y contrasena son requeridos' };
  }

  const normalizedSlug = slug || SUPERADMIN_SLUG;

  const requestHeaders = await headers();
  const rateLimitStatus = authRateLimiter.getStatus({
    slug: normalizedSlug,
    email,
    ip: getClientIpFromHeaders(requestHeaders),
  });

  if (rateLimitStatus.limited) {
    return { error: RATE_LIMIT_LOGIN_ERROR };
  }

  const redirectTo = !slug || slug === SUPERADMIN_SLUG ? '/superadmin' : `/${slug}/dashboard`;

  try {
    await signIn('credentials', {
      slug: normalizedSlug,
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: GENERIC_LOGIN_ERROR };
    }
    throw error;
  }
}

export async function registerAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  void formData;
  return {
    error: 'El autorregistro está deshabilitado. Solicita una invitación a un administrador.',
  };
}
