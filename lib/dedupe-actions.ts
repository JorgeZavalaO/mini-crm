'use server';

import { revalidatePath } from 'next/cache';
import { assertTenantFeatureById, getTenantActionContextBySlug } from '@/lib/auth-guard';
import { buildMergedLeadData } from '@/lib/dedupe-utils';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { canManageDuplicateLeads } from '@/lib/lead-permissions';
import { mergeDuplicateLeadsSchema } from '@/lib/validators';

type LeadActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

function toLeadActorContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
): LeadActorContext {
  return {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

async function assertDedupeEnabled(tenantId: string) {
  try {
    await assertTenantFeatureById(tenantId, 'DEDUPE');
  } catch {
    throw new AppError('La deduplicación está deshabilitada para este tenant', 403);
  }
}

function revalidateDedupeViews(tenantSlug: string, primaryLeadId: string) {
  revalidatePath(`/${tenantSlug}/dashboard`);
  revalidatePath(`/${tenantSlug}/leads`);
  revalidatePath(`/${tenantSlug}/leads/dedupe`);
  revalidatePath(`/${tenantSlug}/leads/${primaryLeadId}`);
}

export async function mergeDuplicateLeadsAction(input: unknown) {
  const parsed = mergeDuplicateLeadsSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud inválida', 400);
  }

  const ctx = await getTenantActionContextBySlug(parsed.data.tenantSlug);
  await assertDedupeEnabled(ctx.tenant.id);

  const actor = toLeadActorContext(ctx);
  if (!canManageDuplicateLeads(actor)) {
    throw new AppError('No autorizado para fusionar duplicados', 403);
  }

  const duplicateLeadIds = Array.from(
    new Set(parsed.data.duplicateLeadIds.filter((leadId) => leadId !== parsed.data.primaryLeadId)),
  );

  if (duplicateLeadIds.length === 0) {
    throw new AppError('Selecciona al menos un lead duplicado para fusionar', 400);
  }

  const leads = await db.lead.findMany({
    where: {
      tenantId: ctx.tenant.id,
      deletedAt: null,
      id: { in: [parsed.data.primaryLeadId, ...duplicateLeadIds] },
    },
    select: {
      id: true,
      businessName: true,
      ruc: true,
      rucNormalized: true,
      nameNormalized: true,
      country: true,
      city: true,
      industry: true,
      source: true,
      notes: true,
      phones: true,
      emails: true,
      status: true,
      ownerId: true,
      updatedAt: true,
    },
  });

  const primary = leads.find((lead) => lead.id === parsed.data.primaryLeadId);
  const duplicates = leads.filter((lead) => duplicateLeadIds.includes(lead.id));

  if (!primary) {
    throw new AppError('Lead principal no encontrado', 404);
  }

  if (duplicates.length !== duplicateLeadIds.length) {
    throw new AppError('Uno o más leads duplicados ya no están disponibles', 404);
  }

  const mergedData = buildMergedLeadData(primary, duplicates);
  const mergedAt = new Date();

  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: primary.id },
      data: mergedData,
    });

    await tx.leadReassignmentRequest.updateMany({
      where: { leadId: { in: duplicateLeadIds } },
      data: { leadId: primary.id },
    });

    await tx.lead.updateMany({
      where: { id: { in: duplicateLeadIds } },
      data: {
        deletedAt: mergedAt,
      },
    });
  });

  revalidateDedupeViews(ctx.tenant.slug, primary.id);

  return {
    success: true,
    primaryLeadId: primary.id,
    mergedCount: duplicateLeadIds.length,
  };
}
