'use server';

import { Prisma, ReassignmentStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getTenantActionContextBySlug, assertTenantFeatureById } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { canOwnLeads } from '@/lib/lead-owner';
import { createNotificationsForEvent, getTenantMemberIds } from '@/lib/notifications-actions';
import {
  normalizeEmails,
  normalizeLeadName,
  normalizePhones,
  normalizeRuc,
} from '@/lib/lead-normalization';
import { canAssignLeads, canEditLead, canResolveReassignment } from '@/lib/lead-permissions';
import { hasRole } from '@/lib/rbac';
import { LEAD_STATUS_LABEL } from '@/lib/lead-status';
import {
  archiveLeadSchema,
  assignLeadSchema,
  bulkAssignSchema,
  createLeadSchema,
  ownerHistoryFiltersSchema,
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

type LeadMutationResult =
  | { success: true; leadId?: string }
  | { success: false; message: string; code?: string; status?: number };

function toLeadMutationError(error: unknown): { message: string; code?: string; status?: number } {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return {
      message: 'Ya existe un lead activo con ese RUC',
      code: 'LEAD_DUPLICATE_RUC',
      status: 409,
    };
  }

  return {
    message: 'No se pudo guardar el lead. Inténtalo nuevamente.',
    status: 500,
  };
}

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
    select: { userId: true, isActive: true, role: true },
  });
  if (!membership || !membership.isActive) {
    throw new AppError('El owner seleccionado no pertenece al tenant o esta inactivo', 400);
  }

  if (!canOwnLeads(membership.role)) {
    throw new AppError(
      'El owner seleccionado debe ser un miembro activo con rol vendedor o superior',
      400,
    );
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
    gerente: payload.gerente ?? null,
    contactName: payload.contactName ?? null,
    contactPhone: payload.contactPhone ?? null,
    status: payload.status,
    ownerId,
    tenantId: ctx.tenantId,
  } satisfies Prisma.LeadUncheckedCreateInput;

  try {
    const lead = await db.lead.create({ data, select: { id: true } });
    revalidateTenantLeadViews(ctx.tenantSlug);

    // Notificación LEAD_NEW a todos los miembros
    const memberIds = await getTenantMemberIds(ctx.tenantId);
    await createNotificationsForEvent({
      tenantId: ctx.tenantId,
      tenantSlug: ctx.tenantSlug,
      type: 'LEAD_NEW',
      title: 'Nuevo lead registrado',
      description: data.businessName + (data.ruc ? ` · ${data.ruc}` : ''),
      href: `/${ctx.tenantSlug}/leads/${lead.id}`,
      recipientUserIds: memberIds.filter((id) => id !== ctx.userId),
    });

    return { success: true, leadId: lead.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('Ya existe un lead activo con ese RUC', 409, 'LEAD_DUPLICATE_RUC');
    }
    throw error;
  }
}

export async function createLeadSafeAction(input: unknown): Promise<LeadMutationResult> {
  try {
    const result = await createLeadAction(input);
    return { success: true, leadId: result.leadId };
  } catch (error) {
    const mapped = toLeadMutationError(error);
    return {
      success: false,
      message: mapped.message,
      code: mapped.code,
      status: mapped.status,
    };
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
    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: payload.leadId, tenantId: ctx.tenantId },
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
          gerente: payload.gerente ?? null,
          contactName: payload.contactName ?? null,
          contactPhone: payload.contactPhone ?? null,
          status: payload.status,
          ...(ownerChanged ? { ownerId: payload.ownerId ?? null } : {}),
        },
      });

      if (ownerChanged) {
        await tx.leadOwnerHistory.create({
          data: {
            leadId: payload.leadId,
            tenantId: ctx.tenantId,
            previousOwnerId: lead.ownerId,
            newOwnerId: payload.ownerId ?? null,
            changedById: ctx.userId,
          },
        });
      }
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

export async function updateLeadSafeAction(input: unknown): Promise<LeadMutationResult> {
  try {
    await updateLeadAction(input);
    return { success: true };
  } catch (error) {
    const mapped = toLeadMutationError(error);
    return {
      success: false,
      message: mapped.message,
      code: mapped.code,
      status: mapped.status,
    };
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
    where: { id: lead.id, tenantId: ctx.tenantId },
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
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id, tenantId: ctx.tenantId },
      data: { ownerId: parsed.data.ownerId },
    });
    await tx.leadOwnerHistory.create({
      data: {
        leadId: lead.id,
        tenantId: ctx.tenantId,
        previousOwnerId: lead.ownerId,
        newOwnerId: parsed.data.ownerId,
        changedById: ctx.userId,
      },
    });
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

  const currentLeads = await db.lead.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null, id: { in: leadIds } },
    select: { id: true, ownerId: true },
  });

  const leadsChanging = currentLeads.filter((l) => l.ownerId !== parsed.data.ownerId);

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.lead.updateMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        id: { in: leadIds },
      },
      data: {
        ownerId: parsed.data.ownerId,
      },
    });

    if (leadsChanging.length > 0) {
      await tx.leadOwnerHistory.createMany({
        data: leadsChanging.map((l) => ({
          leadId: l.id,
          tenantId: ctx.tenantId,
          previousOwnerId: l.ownerId,
          newOwnerId: parsed.data.ownerId,
          changedById: ctx.userId,
        })),
      });
    }

    return updated;
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

  const existingPendingRequest = await db.leadReassignmentRequest.findFirst({
    where: {
      tenantId: ctx.tenantId,
      leadId: lead.id,
      status: ReassignmentStatus.PENDING,
    },
    select: { id: true },
  });

  if (existingPendingRequest) {
    throw new AppError('Ya existe una solicitud pendiente para este lead', 409);
  }

  if (parsed.data.requestedOwnerId) {
    if (parsed.data.requestedOwnerId === lead.ownerId) {
      throw new AppError('El owner sugerido ya es el owner actual del lead', 400);
    }

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

  if (parsed.data.status === ReassignmentStatus.APPROVED && !ownerIdToApply) {
    throw new AppError('Debes seleccionar un owner para aprobar la reasignacion', 400);
  }

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
        previousOwnerId: request.lead.ownerId,
      },
    });

    if (parsed.data.status === ReassignmentStatus.APPROVED && ownerIdToApply !== undefined) {
      await tx.lead.update({
        where: { id: request.lead.id },
        data: { ownerId: ownerIdToApply },
      });
      await tx.leadOwnerHistory.create({
        data: {
          leadId: request.lead.id,
          tenantId: ctx.tenantId,
          previousOwnerId: request.lead.ownerId,
          newOwnerId: ownerIdToApply,
          changedById: ctx.userId,
          reassignmentRequestId: request.id,
        },
      });
    }
  });

  revalidateTenantLeadViews(ctx.tenantSlug);
  return { success: true };
}

export type LeadOwnerHistoryRow = {
  id: string;
  leadId: string;
  previousOwner: { name: string | null; email: string } | null;
  newOwner: { name: string | null; email: string } | null;
  changedBy: { name: string | null; email: string };
  reassignmentRequestId: string | null;
  createdAt: Date;
};

export async function listLeadOwnerHistoryAction(input: unknown): Promise<{
  items: LeadOwnerHistoryRow[];
  total: number;
}> {
  const parsed = ownerHistoryFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, leadId, page, pageSize } = parsed.data;
  const ctx = await getLeadContext(tenantSlug);

  if (!canResolveReassignment(ctx)) {
    throw new AppError('No autorizado para ver el historial de responsables', 403);
  }

  const where = { tenantId: ctx.tenantId, leadId };
  const total = await db.leadOwnerHistory.count({ where });

  const skip = (page - 1) * pageSize;
  const items = await db.leadOwnerHistory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: pageSize,
    select: {
      id: true,
      leadId: true,
      previousOwner: { select: { name: true, email: true } },
      newOwner: { select: { name: true, email: true } },
      changedBy: { select: { name: true, email: true } },
      reassignmentRequestId: true,
      createdAt: true,
    },
  });

  return { items, total };
}

function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function exportLeadsAction(tenantSlug: string): Promise<{
  success: true;
  csv: string;
  rows: string[][];
  filename: string;
}> {
  const ctx = await getLeadContext(tenantSlug);

  if (!ctx.isActiveMember) {
    throw new AppError('No autorizado para exportar leads', 403);
  }

  const isManager = ctx.isSuperAdmin || hasRole(ctx.role, 'SUPERVISOR');

  const leads = await db.lead.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(!isManager ? { ownerId: ctx.userId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      businessName: true,
      ruc: true,
      status: true,
      country: true,
      city: true,
      industry: true,
      source: true,
      gerente: true,
      contactName: true,
      contactPhone: true,
      phones: true,
      emails: true,
      notes: true,
      createdAt: true,
      owner: { select: { name: true, email: true } },
    },
  });

  const headers = [
    'Empresa',
    'RUC',
    'Estado',
    'País',
    'Ciudad',
    'Industria',
    'Fuente',
    'Gerente',
    'Nombre Contacto',
    'Teléfono Contacto',
    'Teléfonos',
    'Emails',
    'Notas',
    'Responsable',
    'Email Responsable',
    'Fecha Creación',
  ];

  const dataRows = leads.map((lead) => [
    lead.businessName ?? '',
    lead.ruc ?? '',
    LEAD_STATUS_LABEL[lead.status] ?? lead.status,
    lead.country ?? '',
    lead.city ?? '',
    lead.industry ?? '',
    lead.source ?? '',
    lead.gerente ?? '',
    lead.contactName ?? '',
    lead.contactPhone ?? '',
    lead.phones.join('; '),
    lead.emails.join('; '),
    lead.notes ?? '',
    lead.owner?.name ?? lead.owner?.email ?? '',
    lead.owner?.email ?? '',
    lead.createdAt.toISOString().slice(0, 10),
  ]);

  const rows: string[][] = [headers, ...dataRows];
  const csvRows = dataRows.map((r) => r.map(csvEscape));
  const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `leads_${tenantSlug}_${date}`;

  return { success: true, csv, rows, filename };
}
