'use server';

import type { InteractionType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getTenantActionContextBySlug, assertTenantFeatureById } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { getPaginationState } from '@/lib/pagination';
import {
  canCreateInteraction,
  canDeleteInteraction,
  canEditInteraction,
} from '@/lib/lead-permissions';
import { suggestStatusTransition } from '@/lib/lead-status-transitions';
import {
  createInteractionSchema,
  deleteInteractionSchema,
  interactionFiltersSchema,
  updateInteractionSchema,
} from '@/lib/validators';

type InteractionActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

function toInteractionActorContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
): InteractionActorContext {
  return {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

async function getInteractionContext(tenantSlug: string): Promise<InteractionActorContext> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  try {
    await assertTenantFeatureById(ctx.tenant.id, 'CRM_LEADS');
  } catch {
    throw new AppError('Feature deshabilitada para este tenant', 403);
  }
  try {
    await assertTenantFeatureById(ctx.tenant.id, 'INTERACTIONS');
  } catch {
    throw new AppError('Interacciones no habilitadas para este tenant', 403);
  }
  return toInteractionActorContext(ctx);
}

function revalidateLeadViews(tenantSlug: string, leadId: string) {
  revalidatePath(`/${tenantSlug}/leads/${leadId}`);
}

export type InteractionRow = {
  id: string;
  leadId: string;
  type: InteractionType;
  subject: string | null;
  notes: string;
  occurredAt: Date;
  createdAt: Date;
  authorId: string;
  author: { name: string | null; email: string };
};

export async function listLeadInteractionsAction(input: unknown): Promise<{
  interactions: InteractionRow[];
  total: number;
}> {
  const parsed = interactionFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, leadId, page, pageSize } = parsed.data;
  const ctx = await getInteractionContext(tenantSlug);

  const where = {
    tenantId: ctx.tenantId,
    leadId,
  };

  const total = await db.interaction.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const interactions = await db.interaction.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      leadId: true,
      type: true,
      subject: true,
      notes: true,
      occurredAt: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true, email: true } },
    },
  });

  return { interactions, total };
}

export async function createInteractionAction(input: unknown) {
  const parsed = createInteractionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de interacción inválidos', 400);
  }
  const { tenantSlug, leadId, type, subject, notes, occurredAt, targetStatus } = parsed.data;

  const ctx = await getInteractionContext(tenantSlug);

  if (!canCreateInteraction(ctx)) {
    throw new AppError('No autorizado para registrar interacciones', 403);
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  // Re-validar la transición en el servidor para no confiar en el cliente
  const allowedTarget = targetStatus != null ? suggestStatusTransition(lead.status, type) : null;
  const applyStatus =
    allowedTarget != null && allowedTarget === targetStatus ? allowedTarget : null;

  const interactionId = await db.$transaction(async (tx) => {
    const created = await tx.interaction.create({
      data: {
        leadId,
        tenantId: ctx.tenantId,
        authorId: ctx.userId,
        type,
        subject: subject ?? null,
        notes,
        occurredAt,
      },
      select: { id: true },
    });

    if (applyStatus != null) {
      await tx.lead.update({
        where: { id: leadId },
        data: { status: applyStatus },
      });
    }

    return created.id;
  });

  revalidateLeadViews(tenantSlug, leadId);
  revalidatePath(`/${tenantSlug}/leads`);
  return { success: true, interactionId };
}

export async function updateInteractionAction(input: unknown) {
  const parsed = updateInteractionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de interacción inválidos', 400);
  }
  const { tenantSlug, interactionId, type, subject, notes, occurredAt } = parsed.data;

  const ctx = await getInteractionContext(tenantSlug);

  const existing = await db.interaction.findFirst({
    where: { id: interactionId, tenantId: ctx.tenantId },
    select: { id: true, leadId: true, authorId: true },
  });
  if (!existing) {
    throw new AppError('Interacción no encontrada', 404);
  }

  if (!canEditInteraction(ctx, existing.authorId)) {
    throw new AppError('No autorizado para editar esta interacción', 403);
  }

  await db.interaction.update({
    where: { id: interactionId, tenantId: ctx.tenantId },
    data: {
      type,
      subject: subject ?? null,
      notes,
      occurredAt,
    },
  });

  revalidateLeadViews(tenantSlug, existing.leadId);
  return { success: true };
}

export async function deleteInteractionAction(input: unknown) {
  const parsed = deleteInteractionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }
  const { tenantSlug, interactionId } = parsed.data;

  const ctx = await getInteractionContext(tenantSlug);

  const existing = await db.interaction.findFirst({
    where: { id: interactionId, tenantId: ctx.tenantId },
    select: { id: true, leadId: true, authorId: true },
  });
  if (!existing) {
    throw new AppError('Interacción no encontrada', 404);
  }

  if (!canDeleteInteraction(ctx, existing.authorId)) {
    throw new AppError('No autorizado para eliminar esta interacción', 403);
  }

  await db.interaction.update({
    where: { id: interactionId, tenantId: ctx.tenantId },
    data: { deletedAt: new Date() },
  });

  revalidateLeadViews(tenantSlug, existing.leadId);
  return { success: true };
}
