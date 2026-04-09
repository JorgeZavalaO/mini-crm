'use server';

import { del, put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { getTenantActionContextBySlug } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { hasRole } from '@/lib/rbac';
import { updateCompanyProfileSchema } from '@/lib/validators';

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const LOGO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type CompanyProfile = {
  companyName: string | null;
  companyRuc: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  companyLogoPathname: string | null;
};

// ─── Permission helper ────────────────────────────────────────────────────────

async function assertCompanyAccess(tenantSlug: string) {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  const { session, membership } = ctx;

  const isAdmin =
    session.user.isSuperAdmin || (membership?.isActive && hasRole(membership.role, 'ADMIN'));

  if (!isAdmin) {
    throw new AppError('Solo administradores pueden modificar el perfil de empresa', 403);
  }

  return ctx;
}

function revalidateCompanyViews(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/company`);
  revalidatePath(`/${tenantSlug}/quotes`);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getCompanyProfileAction(tenantSlug: string): Promise<CompanyProfile> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);

  const tenant = await db.tenant.findFirst({
    where: { id: ctx.tenant.id, deletedAt: null },
    select: {
      companyName: true,
      companyRuc: true,
      companyAddress: true,
      companyPhone: true,
      companyEmail: true,
      companyWebsite: true,
      companyLogoUrl: true,
      companyLogoPathname: true,
    },
  });

  if (!tenant) throw new AppError('Tenant no encontrado', 404);
  return tenant;
}

// ─── Update text fields ───────────────────────────────────────────────────────

export async function updateCompanyProfileAction(input: unknown): Promise<void> {
  const parsed = updateCompanyProfileSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, ...fields } = parsed.data;
  const ctx = await assertCompanyAccess(tenantSlug);

  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      companyName: fields.companyName ?? null,
      companyRuc: fields.companyRuc ?? null,
      companyAddress: fields.companyAddress ?? null,
      companyPhone: fields.companyPhone ?? null,
      companyEmail: fields.companyEmail ?? null,
      companyWebsite: fields.companyWebsite ?? null,
    },
  });

  revalidateCompanyViews(tenantSlug);
}

// ─── Upload logo ──────────────────────────────────────────────────────────────

export async function uploadCompanyLogoAction(
  tenantSlug: string,
  formData: FormData,
): Promise<{ logoUrl: string }> {
  const ctx = await assertCompanyAccess(tenantSlug);

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    throw new AppError('No se recibió ningún archivo', 400);
  }

  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    throw new AppError('Solo se permiten imágenes JPEG, PNG o WEBP', 400);
  }

  if (file.size > LOGO_MAX_BYTES) {
    throw new AppError('El logo no puede superar los 2 MB', 400);
  }

  // Read the current pathname in order to delete the old logo
  const current = await db.tenant.findFirst({
    where: { id: ctx.tenant.id },
    select: { companyLogoPathname: true },
  });

  const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
  const pathname = `company-logos/${ctx.tenant.id}/logo${ext}`;

  // Upload to Vercel Blob (public — logo is embedded in PDFs sent to clients)
  const blob = await put(pathname, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: false,
  });

  // Delete the previous logo from blob storage if pathname changed
  if (current?.companyLogoPathname && current.companyLogoPathname !== pathname) {
    try {
      await del(current.companyLogoPathname);
    } catch {
      // Non-fatal: old blob may already be gone
    }
  }

  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      companyLogoUrl: blob.url,
      companyLogoPathname: blob.pathname,
    },
  });

  revalidateCompanyViews(tenantSlug);
  return { logoUrl: blob.url };
}

// ─── Remove logo ──────────────────────────────────────────────────────────────

export async function removeCompanyLogoAction(tenantSlug: string): Promise<void> {
  const ctx = await assertCompanyAccess(tenantSlug);

  const tenant = await db.tenant.findFirst({
    where: { id: ctx.tenant.id },
    select: { companyLogoPathname: true },
  });

  if (tenant?.companyLogoPathname) {
    try {
      await del(tenant.companyLogoPathname);
    } catch {
      // Non-fatal
    }
  }

  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: { companyLogoUrl: null, companyLogoPathname: null },
  });

  revalidateCompanyViews(tenantSlug);
}
