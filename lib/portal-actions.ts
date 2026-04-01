'use server';

import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { getTenantActionContextBySlug, assertTenantFeatureById } from '@/lib/auth-guard';
import { AppError } from '@/lib/errors';
import { canCreatePortalToken, canRevokePortalToken } from '@/lib/lead-permissions';
import { createPortalTokenSchema, revokePortalTokenSchema } from '@/lib/validators';
import { revalidatePath } from 'next/cache';

function toPermissionContext(ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>) {
  return {
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

// ─── Crear token de portal para un lead ─────────────────

export async function createPortalTokenAction(input: unknown) {
  const parsed = createPortalTokenSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, leadId } = parsed.data;
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'CLIENT_PORTAL');

  const perm = toPermissionContext(ctx);
  if (!canCreatePortalToken(perm)) {
    throw new AppError('No autorizado para crear tokens de portal', 403);
  }

  // Verificar que el lead existe
  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId: ctx.tenant.id, deletedAt: null },
    select: { id: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  const token = randomBytes(32).toString('hex');

  const portalToken = await db.portalToken.create({
    data: {
      tenantId: ctx.tenant.id,
      leadId,
      token,
      createdById: ctx.session.user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
    },
  });

  revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  return { success: true, tokenId: portalToken.id, token };
}

// ─── Revocar token de portal ────────────────────────────

export async function revokePortalTokenAction(input: unknown) {
  const parsed = revokePortalTokenSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, tokenId } = parsed.data;
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'CLIENT_PORTAL');

  const perm = toPermissionContext(ctx);
  if (!canRevokePortalToken(perm)) {
    throw new AppError('No autorizado para revocar tokens de portal', 403);
  }

  const existing = await db.portalToken.findFirst({
    where: { id: tokenId, tenantId: ctx.tenant.id },
    select: { id: true, leadId: true },
  });
  if (!existing) {
    throw new AppError('Token no encontrado', 404);
  }

  await db.portalToken.update({
    where: { id: tokenId },
    data: { isActive: false },
  });

  revalidatePath(`/${tenantSlug}/leads/${existing.leadId}`);
  return { success: true };
}

// ─── Listar tokens de un lead ───────────────────────────

export async function listLeadPortalTokensAction(input: { tenantSlug: string; leadId: string }) {
  const ctx = await getTenantActionContextBySlug(input.tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'CLIENT_PORTAL');

  const tokens = await db.portalToken.findMany({
    where: { tenantId: ctx.tenant.id, leadId: input.leadId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      token: true,
      isActive: true,
      expiresAt: true,
      lastAccessedAt: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return tokens;
}

// ─── Obtener datos públicos del portal por token ────────

export type PortalData = {
  tenantName: string;
  leadName: string;
  leadEmail: string | null;
  quotes: Array<{
    id: string;
    quoteNumber: string;
    status: string;
    totalAmount: number;
    currency: string;
    issuedAt: Date | null;
    validUntil: Date | null;
    createdAt: Date;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      lineSubtotal: number;
    }>;
  }>;
};

export async function getPortalDataByToken(token: string): Promise<PortalData | null> {
  const portalToken = await db.portalToken.findUnique({
    where: { token },
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      tenantId: true,
      leadId: true,
      tenant: { select: { name: true } },
      lead: {
        select: {
          businessName: true,
          emails: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!portalToken) return null;
  if (!portalToken.isActive) return null;
  if (portalToken.expiresAt && portalToken.expiresAt < new Date()) return null;
  if (portalToken.lead.deletedAt) return null;

  // Actualizar last accessed
  await db.portalToken.update({
    where: { id: portalToken.id },
    data: { lastAccessedAt: new Date() },
  });

  const quotes = await db.quote.findMany({
    where: {
      tenantId: portalToken.tenantId,
      leadId: portalToken.leadId,
      deletedAt: null,
      status: { in: ['ENVIADA', 'ACEPTADA', 'RECHAZADA'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      totalAmount: true,
      currency: true,
      issuedAt: true,
      validUntil: true,
      createdAt: true,
      items: {
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
          lineSubtotal: true,
        },
      },
    },
  });

  return {
    tenantName: portalToken.tenant.name,
    leadName: portalToken.lead.businessName,
    leadEmail: portalToken.lead.emails[0] ?? null,
    quotes: quotes.map((q) => ({
      ...q,
      totalAmount: Number(q.totalAmount),
      items: q.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineSubtotal: Number(item.lineSubtotal),
      })),
    })),
  };
}
