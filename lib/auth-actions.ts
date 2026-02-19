'use server';

import { signIn } from '@/auth';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';

// ────────────────────────────────────────────────────────
// Login
// ────────────────────────────────────────────────────────

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  try {
    await signIn('credentials', {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      redirectTo: '/dashboard',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Credenciales inválidas' };
    }
    // NextRedirect throws an error that we must re-throw
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

  // Basic validation
  if (!name || !email || !password || !companyName) {
    return { error: 'Todos los campos son requeridos' };
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' };
  }

  // Check if email is taken
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'El email ya está registrado' };
  }

  // Create user + tenant + membership in a transaction
  const hashed = await hashPassword(password);
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashed },
    });

    const tenant = await tx.tenant.create({
      data: { name: companyName, slug: `${slug}-${user.id.slice(0, 6)}` },
    });

    await tx.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
    });
  });

  // Auto sign-in after registration
  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Registration succeeded but auto-login failed — redirect to login
      redirect('/login');
    }
    throw error;
  }
}
