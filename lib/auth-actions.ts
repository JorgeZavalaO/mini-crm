'use server';

import { signIn } from '@/auth';
import { db } from '@/lib/db';
import { AuthError } from 'next-auth';

const SUPERADMIN_SLUG = 'superadmin';

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const slug = (formData.get('slug') as string | null)?.trim().toLowerCase();
  const email = (formData.get('email') as string | null)?.trim().toLowerCase();
  const password = (formData.get('password') as string | null) ?? '';

  if (!slug || !email || !password) {
    return { error: 'Todos los campos son requeridos' };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, isSuperAdmin: true },
  });
  if (!user) return { error: 'Credenciales invalidas' };

  if (slug === SUPERADMIN_SLUG) {
    if (!user.isSuperAdmin) {
      return { error: 'No tienes acceso al panel de administracion' };
    }
  } else {
    const tenant = await db.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (!tenant || !tenant.isActive || tenant.deletedAt) {
      return { error: 'Empresa no encontrada o inactiva' };
    }

    const membership = await db.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      select: { isActive: true },
    });
    if (!membership || !membership.isActive) {
      return { error: 'No formas parte de esta empresa' };
    }
  }

  const redirectTo = slug === SUPERADMIN_SLUG ? '/superadmin' : `/${slug}/dashboard`;

  try {
    await signIn('credentials', {
      slug,
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Credenciales invalidas' };
    }
    throw error;
  }
}

export async function registerAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  void formData;
  return { error: 'El autorregistro esta deshabilitado. Contacta al administrador.' };
}
