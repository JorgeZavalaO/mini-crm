'use server';

import { signIn } from '@/auth';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';

const SUPERADMIN_SLUG = 'superadmin';

// ────────────────────────────────────────────────────────
// Login
// ────────────────────────────────────────────────────────

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim().toLowerCase();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!slug || !email || !password) {
    return { error: 'Todos los campos son requeridos' };
  }

  // Pre-validación antes de llamar signIn para poder devolver errores descriptivos
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, isSuperAdmin: true },
  });

  if (!user) {
    return { error: 'Credenciales inválidas' };
  }

  if (slug === SUPERADMIN_SLUG) {
    if (!user.isSuperAdmin) {
      return { error: 'No tienes acceso al panel de administración' };
    }
  } else {
    const tenant = await db.tenant.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });

    if (!tenant || !tenant.isActive) {
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
      return { error: 'Credenciales inválidas' };
    }
    throw error;
  }
}

// ────────────────────────────────────────────────────────
// Register
// ────────────────────────────────────────────────────────

export async function registerAction(
  _prevState: { error?: string } | undefined,
  formData: FormData,
) {
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const companyName = (formData.get('companyName') as string)?.trim();

  if (!name || !email || !password || !companyName) {
    return { error: 'Todos los campos son requeridos' };
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'El email ya está registrado' };
  }

  const hashed = await hashPassword(password);
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Create user + tenant + membership
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashed },
    });

    const tenant = await tx.tenant.create({
      data: { name: companyName, slug: `${slug}-${user.id.slice(0, 6)}` },
    });

    await tx.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
    });

    return { tenantSlug: tenant.slug };
  });

  // Auto sign-in after registration
  try {
    await signIn('credentials', {
      slug: result.tenantSlug,
      email,
      password,
      redirectTo: `/${result.tenantSlug}/dashboard`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/login');
    }
    throw error;
  }
}
