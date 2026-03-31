'use server';

import { Prisma, QuoteStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { assertTenantFeatureById, getTenantActionContextBySlug } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { sendQuoteEmail } from '@/lib/email';
import { AppError } from '@/lib/errors';
import {
  canChangeQuoteStatus,
  canCreateQuote,
  canDeleteQuote,
  canEditQuote,
} from '@/lib/lead-permissions';
import {
  changeQuoteStatusSchema,
  createQuoteSchema,
  deleteQuoteSchema,
  quoteFiltersSchema,
  sendQuoteEmailSchema,
  updateQuoteSchema,
} from '@/lib/validators';

type QuoteActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

type QuoteItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

function toQuoteActorContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
): QuoteActorContext {
  return {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

async function getQuoteContext(tenantSlug: string): Promise<QuoteActorContext> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  try {
    await assertTenantFeatureById(ctx.tenant.id, 'CRM_LEADS');
    await assertTenantFeatureById(ctx.tenant.id, 'QUOTING_BASIC');
  } catch {
    throw new AppError('Módulo de cotizaciones no habilitado para este tenant', 403);
  }

  return toQuoteActorContext(ctx);
}

function revalidateQuoteViews(tenantSlug: string, leadId?: string) {
  revalidatePath(`/${tenantSlug}/quotes`);
  if (leadId) {
    revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildQuoteTotals(items: QuoteItemInput[], taxRate: number) {
  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const lineSubtotal = roundMoney(quantity * unitPrice);
    return {
      lineNumber: index + 1,
      description: item.description,
      quantity,
      unitPrice,
      lineSubtotal,
    };
  });

  const subtotal = roundMoney(normalizedItems.reduce((acc, item) => acc + item.lineSubtotal, 0));
  const taxAmount = roundMoney(subtotal * taxRate);
  const totalAmount = roundMoney(subtotal + taxAmount);

  return {
    normalizedItems,
    subtotal,
    taxAmount,
    totalAmount,
  };
}

async function generateQuoteNumber(tenantId: string): Promise<string> {
  const prefix = `Q-${new Date().getFullYear()}`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const total = await db.quote.count({ where: { tenantId } });
    const candidate = `${prefix}-${String(total + 1 + attempt).padStart(6, '0')}`;
    const exists = await db.quote.findFirst({
      where: { tenantId, quoteNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return `${prefix}-${Date.now()}`;
}

function assertAllowedStatusTransition(current: QuoteStatus, next: QuoteStatus) {
  const transitions: Record<QuoteStatus, QuoteStatus[]> = {
    BORRADOR: [QuoteStatus.ENVIADA, QuoteStatus.RECHAZADA],
    ENVIADA: [QuoteStatus.ACEPTADA, QuoteStatus.RECHAZADA],
    ACEPTADA: [],
    RECHAZADA: [],
  };

  if (!transitions[current].includes(next)) {
    throw new AppError(`No se puede cambiar de ${current} a ${next}`, 400);
  }
}

export async function createQuoteAction(input: unknown) {
  const parsed = createQuoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de cotización inválidos', 400);
  }

  const { tenantSlug, leadId, currency, items, notes, taxRate, validUntil } = parsed.data;
  const ctx = await getQuoteContext(tenantSlug);

  if (!canCreateQuote(ctx)) {
    throw new AppError('No autorizado para crear cotizaciones', 403);
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  const { normalizedItems, subtotal, taxAmount, totalAmount } = buildQuoteTotals(items, taxRate);
  const quoteNumber = await generateQuoteNumber(ctx.tenantId);

  const quote = await db.quote.create({
    data: {
      tenantId: ctx.tenantId,
      leadId,
      quoteNumber,
      currency,
      taxRate: new Prisma.Decimal(taxRate),
      subtotal: new Prisma.Decimal(subtotal),
      taxAmount: new Prisma.Decimal(taxAmount),
      totalAmount: new Prisma.Decimal(totalAmount),
      validUntil,
      notes: notes ?? null,
      createdById: ctx.userId,
      items: {
        create: normalizedItems.map((item) => ({
          lineNumber: item.lineNumber,
          description: item.description,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice),
          lineSubtotal: new Prisma.Decimal(item.lineSubtotal),
        })),
      },
    },
    select: { id: true },
  });

  // Trazabilidad: interacción automática en el historial del lead
  await db.interaction.create({
    data: {
      tenantId: ctx.tenantId,
      leadId,
      authorId: ctx.userId,
      type: 'NOTE',
      occurredAt: new Date(),
      notes: `Cotización ${quoteNumber} creada · Total: ${new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(totalAmount)}.`,
    },
  });

  revalidateQuoteViews(tenantSlug, leadId);
  return { success: true, quoteId: quote.id };
}

export async function updateQuoteAction(input: unknown) {
  const parsed = updateQuoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de cotización inválidos', 400);
  }

  const { quoteId, tenantSlug, leadId, currency, items, notes, taxRate, validUntil } = parsed.data;

  const ctx = await getQuoteContext(tenantSlug);

  const existing = await db.quote.findFirst({
    where: { id: quoteId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, leadId: true, createdById: true, status: true },
  });
  if (!existing) {
    throw new AppError('Cotización no encontrada', 404);
  }

  if (!canEditQuote(ctx, { createdById: existing.createdById, status: existing.status })) {
    throw new AppError('No autorizado para editar esta cotización', 403);
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }

  const { normalizedItems, subtotal, taxAmount, totalAmount } = buildQuoteTotals(items, taxRate);

  await db.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        leadId,
        currency,
        taxRate: new Prisma.Decimal(taxRate),
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        validUntil,
        notes: notes ?? null,
      },
    });

    await tx.quoteItem.deleteMany({ where: { quoteId } });
    await tx.quoteItem.createMany({
      data: normalizedItems.map((item) => ({
        quoteId,
        lineNumber: item.lineNumber,
        description: item.description,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice: new Prisma.Decimal(item.unitPrice),
        lineSubtotal: new Prisma.Decimal(item.lineSubtotal),
      })),
    });
  });

  revalidateQuoteViews(tenantSlug, existing.leadId);
  revalidateQuoteViews(tenantSlug, leadId);
  return { success: true };
}

export async function changeQuoteStatusAction(input: unknown) {
  const parsed = changeQuoteStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { quoteId, tenantSlug, status } = parsed.data;
  const ctx = await getQuoteContext(tenantSlug);

  if (!canChangeQuoteStatus(ctx)) {
    throw new AppError('No autorizado para cambiar estado de cotizaciones', 403);
  }

  const existing = await db.quote.findFirst({
    where: { id: quoteId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, leadId: true, status: true },
  });
  if (!existing) {
    throw new AppError('Cotización no encontrada', 404);
  }

  assertAllowedStatusTransition(existing.status, status);

  await db.quote.update({
    where: { id: quoteId },
    data: {
      status,
      issuedAt: status === QuoteStatus.ENVIADA ? new Date() : undefined,
    },
  });

  revalidateQuoteViews(tenantSlug, existing.leadId);
  return { success: true };
}

export async function deleteQuoteAction(input: unknown) {
  const parsed = deleteQuoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, quoteId } = parsed.data;
  const ctx = await getQuoteContext(tenantSlug);

  const existing = await db.quote.findFirst({
    where: { id: quoteId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, leadId: true, createdById: true, status: true },
  });

  if (!existing) {
    throw new AppError('Cotización no encontrada', 404);
  }

  if (!canDeleteQuote(ctx, { createdById: existing.createdById, status: existing.status })) {
    throw new AppError('No autorizado para eliminar esta cotización', 403);
  }

  await db.quote.update({
    where: { id: quoteId },
    data: { deletedAt: new Date() },
  });

  revalidateQuoteViews(tenantSlug, existing.leadId);
  return { success: true };
}

export type QuoteRow = {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  currency: 'PEN' | 'USD';
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number;
  leadId: string;
  leadName: string;
  createdBy: { name: string | null; email: string };
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  validUntil: Date | null;
};

export async function listLeadQuotesAction(
  leadId: string,
  tenantSlug: string,
): Promise<QuoteRow[]> {
  const ctx = await getQuoteContext(tenantSlug);

  const quotes = await db.quote.findMany({
    where: { tenantId: ctx.tenantId, leadId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      currency: true,
      taxRate: true,
      subtotal: true,
      taxAmount: true,
      totalAmount: true,
      leadId: true,
      createdById: true,
      createdBy: { select: { name: true, email: true } },
      createdAt: true,
      updatedAt: true,
      validUntil: true,
      lead: { select: { businessName: true } },
    },
  });

  return quotes.map((quote) => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    currency: quote.currency,
    taxRate: Number(quote.taxRate),
    subtotal: Number(quote.subtotal),
    taxAmount: Number(quote.taxAmount),
    totalAmount: Number(quote.totalAmount),
    leadId: quote.leadId,
    leadName: quote.lead.businessName,
    createdById: quote.createdById,
    createdBy: quote.createdBy,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    validUntil: quote.validUntil,
  }));
}

export async function listTenantQuotesAction(
  input: unknown,
): Promise<{ quotes: QuoteRow[]; total: number }> {
  const parsed = quoteFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, leadId, page, pageSize, q, status } = parsed.data;
  const ctx = await getQuoteContext(tenantSlug);

  const where: Prisma.QuoteWhereInput = {
    tenantId: ctx.tenantId,
    deletedAt: null,
    leadId: leadId ?? undefined,
    status: status ?? undefined,
    OR: q
      ? [
          { quoteNumber: { contains: q, mode: 'insensitive' } },
          { lead: { businessName: { contains: q, mode: 'insensitive' } } },
        ]
      : undefined,
  };

  const [quotes, total] = await Promise.all([
    db.quote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        currency: true,
        taxRate: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        leadId: true,
        createdById: true,
        createdBy: { select: { name: true, email: true } },
        createdAt: true,
        updatedAt: true,
        validUntil: true,
        lead: { select: { businessName: true } },
      },
    }),
    db.quote.count({ where }),
  ]);

  return {
    quotes: quotes.map((quote) => ({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      currency: quote.currency,
      taxRate: Number(quote.taxRate),
      subtotal: Number(quote.subtotal),
      taxAmount: Number(quote.taxAmount),
      totalAmount: Number(quote.totalAmount),
      leadId: quote.leadId,
      leadName: quote.lead.businessName,
      createdById: quote.createdById,
      createdBy: quote.createdBy,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      validUntil: quote.validUntil,
    })),
    total,
  };
}

export async function getQuoteDetailAction(quoteId: string, tenantSlug: string) {
  const ctx = await getQuoteContext(tenantSlug);

  const quote = await db.quote.findFirst({
    where: { id: quoteId, tenantId: ctx.tenantId, deletedAt: null },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      currency: true,
      taxRate: true,
      subtotal: true,
      taxAmount: true,
      totalAmount: true,
      issuedAt: true,
      validUntil: true,
      notes: true,
      createdById: true,
      createdBy: { select: { name: true, email: true } },
      createdAt: true,
      updatedAt: true,
      lead: {
        select: {
          id: true,
          businessName: true,
          ruc: true,
        },
      },
      items: {
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          lineNumber: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineSubtotal: true,
        },
      },
    },
  });

  if (!quote) {
    throw new AppError('Cotización no encontrada', 404);
  }

  return {
    ...quote,
    taxRate: Number(quote.taxRate),
    subtotal: Number(quote.subtotal),
    taxAmount: Number(quote.taxAmount),
    totalAmount: Number(quote.totalAmount),
    items: quote.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineSubtotal: Number(item.lineSubtotal),
    })),
  };
}

export async function sendQuoteEmailAction(input: unknown) {
  const parsed = sendQuoteEmailSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, quoteId, recipientEmail } = parsed.data;
  const ctx = await getQuoteContext(tenantSlug);

  if (!canChangeQuoteStatus(ctx)) {
    throw new AppError('No autorizado para enviar cotizaciones', 403);
  }

  const quote = await db.quote.findFirst({
    where: { id: quoteId, tenantId: ctx.tenantId, deletedAt: null },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      currency: true,
      taxRate: true,
      subtotal: true,
      taxAmount: true,
      totalAmount: true,
      validUntil: true,
      notes: true,
      leadId: true,
      lead: { select: { businessName: true } },
      items: {
        orderBy: { lineNumber: 'asc' },
        select: {
          lineNumber: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineSubtotal: true,
        },
      },
    },
  });

  if (!quote) throw new AppError('Cotización no encontrada', 404);

  const sender = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true },
  });

  await sendQuoteEmail({
    to: recipientEmail,
    quoteNumber: quote.quoteNumber,
    clientName: quote.lead.businessName,
    currency: quote.currency as 'PEN' | 'USD',
    taxRate: Number(quote.taxRate),
    subtotal: Number(quote.subtotal),
    taxAmount: Number(quote.taxAmount),
    totalAmount: Number(quote.totalAmount),
    validUntil: quote.validUntil,
    notes: quote.notes,
    senderName: sender?.name ?? 'Mini CRM',
    items: quote.items.map((item) => ({
      lineNumber: item.lineNumber,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineSubtotal: Number(item.lineSubtotal),
    })),
  });

  // Transicionar a ENVIADA si estaba en BORRADOR
  if (quote.status === QuoteStatus.BORRADOR) {
    await db.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.ENVIADA, issuedAt: new Date() },
    });
  }

  revalidateQuoteViews(tenantSlug, quote.leadId);
  return { success: true };
}
