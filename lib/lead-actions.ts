'use server';

import { Prisma, ReassignmentStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getTenantActionContextBySlug, assertTenantFeatureById } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import {
  normalizeEmails,
  normalizeLeadName,
  normalizePhones,
  normalizeRuc,
} from '@/lib/lead-normalization';
import { canAssignLeads, canEditLead, canResolveReassignment } from '@/lib/lead-permissions';
import {
  archiveLeadSchema,
  assignLeadSchema,
  bulkAssignSchema,
  createLeadSchema,
  requestReassignSchema,
  resolveReassignSchema,
  updateLeadSchema,
} from '@/lib/validators';

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

async function getLeadContext(tenantSlug: string): Promise<LeadActorContext> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertFeatureEnabled(ctx.tenant.id, 'CRM_LEADS');
  return toLeadActorContext(ctx);
}

async function assertFeatureEnabled(tenantId: string, featureKey: 'CRM_LEADS' | 'ASSIGNMENTS') {
  try {
    await assertTenantFeatureById(tenantId, featureKey);
  } catch {
    throw new AppError('Feature deshabilitada para este tenant', 403);
  }
}

async function assertOwnerBelongsToTenant(tenantId: string, ownerId: string) {
  const membership = await db.membership.findUnique({
    where: { userId_tenantId: { userId: ownerId, tenantId } },
    select: { userId: true, isActive: true },
  });
  if (!membership || !membership.isActive) {
    throw new AppError('El owner seleccionado no pertenece al tenant o esta inactivo', 400);
  }
}

async function assertUniqueRuc(
  tenantId: string,
  rucNormalized: string | null,
  excludeLeadId?: string,
) {
  if (!rucNormalized) return;

  const existing = await db.lead.findFirst({
    where: {
      tenantId,
      rucNormalized,
      deletedAt: null,
      ...(excludeLeadId ? { NOT: { id: excludeLeadId } } : {}),
    },
    select: { id: true, businessName: true },
  });

  if (existing) {
    throw new AppError(
      `Ya existe un lead activo con ese RUC: ${existing.businessName}`,
      409,
      'LEAD_DUPLICATE_RUC',
    );
  }
}

function revalidateTenantLeadViews(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/leads`);
  revalidatePath(`/${tenantSlug}/dashboard`);
}

function parseCreatePayload(input: unknown) {
  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de lead invalidos', 400);
  }
  return parsed.data;
}

function parseUpdatePayload(input: unknown) {
  const parsed = updateLeadSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de lead invalidos', 400);
  }
  return parsed.data;
}

export async function createLeadAction(input: unknown) {
  const payload = parseCreatePayload(input);
  const ctx = await getLeadContext(payload.tenantSlug);

  const ownerId = payload.ownerId ?? null;
  if (ownerId && !canAssignLeads(ctx)) {
    throw new AppError('No autorizado para asignar leads', 403);
  }
  if (ownerId) {
    await assertOwnerBelongsToTenant(ctx.tenantId, ownerId);
  }

  const rucNormalized = normalizeRuc(payload.ruc);
  await assertUniqueRuc(ctx.tenantId, rucNormalized);

  const data = {
    businessName: payload.businessName.trim(),
    ruc: payload.ruc?.trim() ?? null,
    rucNormalized,
    nameNormalized: normalizeLeadName(payload.businessName),
    country: payload.country ?? null,
    city: payload.city ?? null,
    industry: payload.industry ?? null,
    source: payload.source ?? null,
    notes: payload.notes ?? null,
    phones: normalizePhones(payload.phones),
    emails: normalizeEmails(payload.emails),
    status: payload.status,
    ownerId,
    tenantId: ctx.tenantId,
  } satisfies Prisma.LeadUncheckedCreateInput;

  try {
    const lead = await db.lead.create({ data, select: { id: true } });
    revalidateTenantLeadViews(ctx.tenantSlug);
    return { success: true, leadId: lead.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Ya existe un lead activo con ese RUC', 409, 'LEAD_DUPLICATE_RUC');
    }
    throw error;
  }
}

export async function updateLeadAction(input: unknown) {
  const payload = parseUpdatePayload(input);
  const ctx = await getLeadContext(payload.tenantSlug);

  const lead = await db.lead.findFirst({
    where: { id: payload.leadId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  if (!canEditLead(ctx, { ownerId: lead.ownerId })) {
    throw new AppError('No autorizado para editar este lead', 403);
  }

  const ownerChanged =
    payload.ownerId !== undefined && (payload.ownerId ?? null) !== (lead.ownerId ?? null);
  if (ownerChanged) {
    if (!canAssignLeads(ctx)) {
      throw new AppError('No autorizado para cambiar owner', 403);
    }
    if (payload.ownerId) {
      await assertOwnerBelongsToTenant(ctx.tenantId, payload.ownerId);
    }
  }

  const rucNormalized = normalizeRuc(payload.ruc);
  await assertUniqueRuc(ctx.tenantId, rucNormalized, payload.leadId);

  try {
    await db.lead.update({
      where: { id: payload.leadId },
      data: {
        businessName: payload.businessName.trim(),
        ruc: payload.ruc?.trim() ?? null,
        rucNormalized,
        nameNormalized: normalizeLeadName(payload.businessName),
        country: payload.country ?? null,
        city: payload.city ?? null,
        industry: payload.industry ?? null,
        source: payload.source ?? null,
        notes: payload.notes ?? null,
        phones: normalizePhones(payload.phones),
        emails: normalizeEmails(payload.emails),
        status: payload.status,
        ...(ownerChanged ? { ownerId: payload.ownerId ?? null } : {}),
      },
    });
    revalidateTenantLeadViews(ctx.tenantSlug);
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Ya existe un lead activo con ese RUC', 409, 'LEAD_DUPLICATE_RUC');
    }
    throw error;
  }
}

export async function archiveLeadAction(input: unknown) {
  const parsed = archiveLeadSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud invalida', 400);
  }

  const ctx = await getLeadContext(parsed.data.tenantSlug);
  const lead = await db.lead.findFirst({
    where: { id: parsed.data.leadId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }
  if (!canEditLead(ctx, { ownerId: lead.ownerId })) {
    throw new AppError('No autorizado para archivar este lead', 403);
  }

  await db.lead.update({
    where: { id: lead.id },
    data: { deletedAt: new Date() },
  });

  revalidateTenantLeadViews(ctx.tenantSlug);
  return { success: true };
}

export async function assignLeadAction(input: unknown) {
  const parsed = assignLeadSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud invalida', 400);
  }

  const ctx = await getLeadContext(parsed.data.tenantSlug);
  await assertFeatureEnabled(ctx.tenantId, 'ASSIGNMENTS');
  if (!canAssignLeads(ctx)) {
    throw new AppError('No autorizado para asignar leads', 403);
  }

  await assertOwnerBelongsToTenant(ctx.tenantId, parsed.data.ownerId);

  const lead = await db.lead.findFirst({
    where: { id: parsed.data.leadId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  await db.lead.update({
    where: { id: parsed.data.leadId },
    data: { ownerId: parsed.data.ownerId },
  });

  revalidateTenantLeadViews(ctx.tenantSlug);
  return { success: true };
}

export async function bulkAssignLeadsAction(input: unknown) {
  const parsed = bulkAssignSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud invalida', 400);
  }

  const ctx = await getLeadContext(parsed.data.tenantSlug);
  await assertFeatureEnabled(ctx.tenantId, 'ASSIGNMENTS');
  if (!canAssignLeads(ctx)) {
    throw new AppError('No autorizado para asignar leads', 403);
  }

  const leadIds = Array.from(new Set(parsed.data.leadIds));
  await assertOwnerBelongsToTenant(ctx.tenantId, parsed.data.ownerId);

  const result = await db.lead.updateMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      id: { in: leadIds },
    },
    data: {
      ownerId: parsed.data.ownerId,
    },
  });

  revalidateTenantLeadViews(ctx.tenantSlug);
  return { success: true, updatedCount: result.count };
}

export async function requestLeadReassignmentAction(input: unknown) {
  const parsed = requestReassignSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud invalida', 400);
  }

  const ctx = await getLeadContext(parsed.data.tenantSlug);
  await assertFeatureEnabled(ctx.tenantId, 'ASSIGNMENTS');

  const lead = await db.lead.findFirst({
    where: { id: parsed.data.leadId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  if (canEditLead(ctx, { ownerId: lead.ownerId })) {
    throw new AppError('Ya tienes permisos para editar este lead', 400);
  }

  if (parsed.data.requestedOwnerId) {
    await assertOwnerBelongsToTenant(ctx.tenantId, parsed.data.requestedOwnerId);
  }

  const request = await db.leadReassignmentRequest.create({
    data: {
      leadId: lead.id,
      tenantId: ctx.tenantId,
      requestedById: ctx.userId,
      requestedOwnerId: parsed.data.requestedOwnerId ?? null,
      reason: parsed.data.reason,
      status: ReassignmentStatus.PENDING,
    },
    select: { id: true },
  });

  revalidateTenantLeadViews(ctx.tenantSlug);
  return { success: true, requestId: request.id };
}

export async function resolveLeadReassignmentAction(input: unknown) {
  const parsed = resolveReassignSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud invalida', 400);
  }

  const ctx = await getLeadContext(parsed.data.tenantSlug);
  await assertFeatureEnabled(ctx.tenantId, 'ASSIGNMENTS');
  if (!canResolveReassignment(ctx)) {
    throw new AppError('No autorizado para resolver solicitudes', 403);
  }

  const request = await db.leadReassignmentRequest.findFirst({
    where: { id: parsed.data.requestId, tenantId: ctx.tenantId },
    include: { lead: { select: { id: true, ownerId: true } } },
  });
  if (!request) {
    throw new AppError('Solicitud no encontrada', 404);
  }
  if (request.status !== ReassignmentStatus.PENDING) {
    throw new AppError('La solicitud ya fue resuelta', 400);
  }

  const ownerIdToApply = parsed.data.ownerId ?? request.requestedOwnerId ?? undefined;

  if (ownerIdToApply) {
    await assertOwnerBelongsToTenant(ctx.tenantId, ownerIdToApply);
  }

  await db.$transaction(async (tx) => {
    await tx.leadReassignmentRequest.update({
      where: { id: request.id },
      data: {
        status: parsed.data.status,
        resolvedById: ctx.userId,
        resolvedAt: new Date(),
        resolutionNote: parsed.data.resolutionNote ?? null,
      },
    });

    if (parsed.data.status === ReassignmentStatus.APPROVED && ownerIdToApply !== undefined) {
      await tx.lead.update({
        where: { id: request.lead.id },
        data: { ownerId: ownerIdToApply },
      });
    }
  });

  revalidateTenantLeadViews(ctx.tenantSlug);
  return { success: true };
}
