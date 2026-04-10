'use server';

import type { QuoteStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { assertTenantFeatureById, getTenantActionContextBySlug } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import {
  canCreatePortalToken,
  canRevokePortalToken,
  canViewPortalTokens,
} from '@/lib/lead-permissions';
import { getPaginationState } from '@/lib/pagination';
import {
  createPortalToken,
  getPortalTokenExpiresAt,
  hashPortalToken,
  isPortalTokenActive,
} from '@/lib/portal-tokens';
import {
  createPortalTokenSchema,
  portalTokenFiltersSchema,
  revokePortalTokenSchema,
} from '@/lib/validators';

const PORTAL_VISIBLE_QUOTE_STATUSES: QuoteStatus[] = ['ENVIADA', 'ACEPTADA', 'RECHAZADA'];

function toPermissionContext(ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>) {
  return {
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

function assertPortalTokenReadAccess(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
) {
  const perm = toPermissionContext(ctx);

  if (!canViewPortalTokens(perm)) {
    throw new AppError('No autorizado para ver tokens de portal', 403);
  }
}

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

  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId: ctx.tenant.id, deletedAt: null },
    select: { id: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  const { rawToken, tokenHash } = createPortalToken();
  const expiresAt = getPortalTokenExpiresAt();

  const portalToken = await db.portalToken.create({
    data: {
      tenantId: ctx.tenant.id,
      leadId,
      tokenHash,
      createdById: ctx.session.user.id,
      expiresAt,
    },
  });

  revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  return {
    success: true,
    tokenId: portalToken.id,
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
  };
}

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

export async function listLeadPortalTokensAction(input: { tenantSlug: string; leadId: string }) {
  const ctx = await getTenantActionContextBySlug(input.tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'CLIENT_PORTAL');
  assertPortalTokenReadAccess(ctx);

  return db.portalToken.findMany({
    where: { tenantId: ctx.tenant.id, leadId: input.leadId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      lastAccessedAt: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
}

export async function listLeadPortalTokensPageAction(input: unknown): Promise<{
  tokens: Awaited<ReturnType<typeof listLeadPortalTokensAction>>;
  total: number;
}> {
  const parsed = portalTokenFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, leadId, page, pageSize } = parsed.data;
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'CLIENT_PORTAL');
  assertPortalTokenReadAccess(ctx);

  const where = { tenantId: ctx.tenant.id, leadId };
  const total = await db.portalToken.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const tokens = await db.portalToken.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      lastAccessedAt: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });

  return { tokens, total };
}

export type PortalData = {
  tenantName: string;
  tenantTimezone: string;
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
    where: { tokenHash: hashPortalToken(token) },
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      tenantId: true,
      leadId: true,
      tenant: { select: { name: true, companyTimezone: true } },
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
  if (!isPortalTokenActive(portalToken)) return null;
  if (portalToken.lead.deletedAt) return null;

  await db.portalToken.update({
    where: { id: portalToken.id },
    data: { lastAccessedAt: new Date() },
  });

  const quotes = await db.quote.findMany({
    where: {
      tenantId: portalToken.tenantId,
      leadId: portalToken.leadId,
      deletedAt: null,
      status: { in: PORTAL_VISIBLE_QUOTE_STATUSES },
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
    tenantTimezone: portalToken.tenant.companyTimezone,
    leadName: portalToken.lead.businessName,
    leadEmail: portalToken.lead.emails[0] ?? null,
    quotes: quotes.map((quote) => ({
      ...quote,
      totalAmount: Number(quote.totalAmount),
      items: quote.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineSubtotal: Number(item.lineSubtotal),
      })),
    })),
  };
}

export async function getPortalQuotesPageByToken(
  token: string,
  page = 1,
  pageSize = 6,
): Promise<(PortalData & { total: number }) | null> {
  const portalToken = await db.portalToken.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      tenantId: true,
      leadId: true,
      tenant: { select: { name: true, companyTimezone: true } },
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
  if (!isPortalTokenActive(portalToken)) return null;
  if (portalToken.lead.deletedAt) return null;

  await db.portalToken.update({
    where: { id: portalToken.id },
    data: { lastAccessedAt: new Date() },
  });

  const where = {
    tenantId: portalToken.tenantId,
    leadId: portalToken.leadId,
    deletedAt: null,
    status: { in: PORTAL_VISIBLE_QUOTE_STATUSES },
  };

  const total = await db.quote.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const quotes = await db.quote.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pageSize,
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
    tenantTimezone: portalToken.tenant.companyTimezone,
    leadName: portalToken.lead.businessName,
    leadEmail: portalToken.lead.emails[0] ?? null,
    total,
    quotes: quotes.map((quote) => ({
      ...quote,
      totalAmount: Number(quote.totalAmount),
      items: quote.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineSubtotal: Number(item.lineSubtotal),
      })),
    })),
  };
}
