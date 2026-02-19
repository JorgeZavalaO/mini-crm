'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function assertSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('No autorizado');
  }
  return session;
}

// ────────────────────────────────────────────────────────
// Create Tenant + Admin user
// ────────────────────────────────────────────────────────

export async function createTenantAction(
  _prevState: { error?: string; success?: string } | undefined,
  formData: FormData,
) {
  await assertSuperAdmin();

  const companyName = (formData.get('companyName') as string)?.trim();
  const slug = (formData.get('slug') as string)?.trim().toLowerCase();
  const adminName = (formData.get('adminName') as string)?.trim();
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase();
  const adminPassword = formData.get('adminPassword') as string;

  if (!companyName || !slug || !adminName || !adminEmail || !adminPassword) {
    return { error: 'Todos los campos son requeridos' };
  }

  if (adminPassword.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' };
  }

  // Validate slug format
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: 'El slug solo puede contener letras minúsculas, números y guiones' };
  }

  // Check slug uniqueness
  const existingTenant = await db.tenant.findUnique({ where: { slug } });
  if (existingTenant) {
    return { error: 'Ya existe una empresa con ese slug' };
  }

  // Check email uniqueness
  const existingUser = await db.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return { error: 'Ya existe un usuario con ese email' };
  }

  const hashed = await hashPassword(adminPassword);

  await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: companyName, slug },
    });

    const user = await tx.user.create({
      data: { name: adminName, email: adminEmail, password: hashed },
    });

    await tx.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
    });
  });

  redirect('/superadmin');
}

// ────────────────────────────────────────────────────────
// Toggle Tenant active/inactive
// ────────────────────────────────────────────────────────

export async function toggleTenantAction(
  tenantId: string,
): Promise<{ success: boolean; isActive: boolean; name: string }> {
  await assertSuperAdmin();

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant no encontrado');

  const updated = await db.tenant.update({
    where: { id: tenantId },
    data: { isActive: !tenant.isActive },
  });

  revalidatePath('/superadmin');
  return { success: true, isActive: updated.isActive, name: updated.name };
}

// ────────────────────────────────────────────────────────
// Update Tenant info
// ────────────────────────────────────────────────────────

export async function updateTenantAction(
  _prevState: { error?: string; success?: string } | undefined,
  formData: FormData,
) {
  await assertSuperAdmin();

  const tenantId = formData.get('tenantId') as string;
  const name = (formData.get('name') as string)?.trim();

  if (!tenantId || !name) {
    return { error: 'Nombre es requerido' };
  }

  await db.tenant.update({
    where: { id: tenantId },
    data: { name },
  });

  return { success: 'Tenant actualizado' };
}
