import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { getTenantActionContextBySlugMock, assertTenantFeatureByIdMock } = vi.hoisted(() => ({
  getTenantActionContextBySlugMock: vi.fn(),
  assertTenantFeatureByIdMock: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({
  getTenantActionContextBySlug: getTenantActionContextBySlugMock,
  assertTenantFeatureById: assertTenantFeatureByIdMock,
}));

const { getTenantMemberIdsMock, createNotificationsForEventMock } = vi.hoisted(() => ({
  getTenantMemberIdsMock: vi.fn(),
  createNotificationsForEventMock: vi.fn(),
}));

vi.mock('@/lib/notifications-actions', () => ({
  getTenantMemberIds: getTenantMemberIdsMock,
  createNotificationsForEvent: createNotificationsForEventMock,
}));

const { sendQuoteEmailMock } = vi.hoisted(() => ({
  sendQuoteEmailMock: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendQuoteEmail: sendQuoteEmailMock,
}));

const txMock = vi.hoisted(() => ({
  tenant: {
    update: vi.fn(),
  },
  quote: {
    create: vi.fn(),
    update: vi.fn(),
  },
  quoteItem: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  interaction: {
    create: vi.fn(),
  },
}));

const dbMock = vi.hoisted(() => ({
  quote: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  changeQuoteStatusAction,
  createQuoteAction,
  deleteQuoteAction,
  getQuoteDetailAction,
  listLeadQuotesAction,
  listTenantQuotesAction,
  sendQuoteEmailAction,
  updateQuoteAction,
} from '@/lib/quote-actions';

const TENANT_ID = 'tenant-1';
const TENANT_SLUG = 'acme';
const LEAD_ID = 'lead-1';
const USER_ID = 'user-1';

function makeContext(role = 'VENDEDOR', isActive = true, isSuperAdmin = false) {
  return {
    session: { user: { id: USER_ID, isSuperAdmin } },
    tenant: { id: TENANT_ID, slug: TENANT_SLUG, name: 'Acme', isActive: true },
    membership: { id: 'm1', role, isActive },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTenantActionContextBySlugMock.mockResolvedValue(makeContext());
  assertTenantFeatureByIdMock.mockResolvedValue(undefined);
  getTenantMemberIdsMock.mockResolvedValue([]);
  createNotificationsForEventMock.mockResolvedValue(undefined);
  sendQuoteEmailMock.mockResolvedValue(undefined);
  dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
  dbMock.user.findUnique.mockResolvedValue({ name: 'Jorge' });
  dbMock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
  txMock.tenant.update.mockResolvedValue({ quoteSequence: 1 });
  txMock.quote.create.mockResolvedValue({ id: 'quote-1', quoteNumber: 'Q-2026-000001' });
  txMock.interaction.create.mockResolvedValue({ id: 'int-1' });
  txMock.quote.update.mockResolvedValue({});
  txMock.quoteItem.deleteMany.mockResolvedValue({ count: 0 });
  txMock.quoteItem.createMany.mockResolvedValue({ count: 1 });
});

describe('createQuoteAction', () => {
  it('crea cotizacion valida usando quoteSequence transaccional y revalida rutas', async () => {
    const result = await createQuoteAction({
      tenantSlug: TENANT_SLUG,
      leadId: LEAD_ID,
      currency: 'PEN',
      taxRate: 0.18,
      items: [{ description: 'Servicio mensual', quantity: 2, unitPrice: 100 }],
    });

    expect(result.success).toBe(true);
    expect(txMock.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { quoteSequence: { increment: 1 } },
      select: { quoteSequence: true },
    });
    expect(txMock.quote.create).toHaveBeenCalledOnce();
    expect(txMock.interaction.create).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/quotes`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });

  it('falla cuando lead no existe', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(
      createQuoteAction({
        tenantSlug: TENANT_SLUG,
        leadId: LEAD_ID,
        currency: 'PEN',
        taxRate: 0.18,
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toThrow('Lead no encontrado');
  });

  it('falla para miembro inactivo', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeContext('VENDEDOR', false));

    await expect(
      createQuoteAction({
        tenantSlug: TENANT_SLUG,
        leadId: LEAD_ID,
        currency: 'PEN',
        taxRate: 0.18,
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toThrow('No autorizado');
  });
});

describe('changeQuoteStatusAction', () => {
  it('permite transicion BORRADOR -> ENVIADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      status: 'BORRADOR',
      quoteNumber: 'Q-2026-000001',
    });
    dbMock.quote.update.mockResolvedValue({});

    await expect(
      changeQuoteStatusAction({ tenantSlug: TENANT_SLUG, quoteId: 'q1', status: 'ENVIADA' }),
    ).resolves.not.toThrow();

    expect(dbMock.quote.update).toHaveBeenCalledOnce();
  });

  it('bloquea transicion invalida BORRADOR -> ACEPTADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      status: 'BORRADOR',
      quoteNumber: 'Q-2026-000001',
    });

    await expect(
      changeQuoteStatusAction({ tenantSlug: TENANT_SLUG, quoteId: 'q1', status: 'ACEPTADA' }),
    ).rejects.toThrow('No se puede cambiar');
  });
});

describe('deleteQuoteAction', () => {
  it('permite eliminar borrador propio', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      createdById: USER_ID,
      status: 'BORRADOR',
    });
    dbMock.quote.update.mockResolvedValue({});

    await expect(
      deleteQuoteAction({ tenantSlug: TENANT_SLUG, quoteId: 'q1' }),
    ).resolves.not.toThrow();
    expect(dbMock.quote.update).toHaveBeenCalledOnce();
  });

  it('bloquea eliminar ENVIADA para vendedor no supervisor', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      createdById: USER_ID,
      status: 'ENVIADA',
    });

    await expect(deleteQuoteAction({ tenantSlug: TENANT_SLUG, quoteId: 'q1' })).rejects.toThrow(
      'No autorizado',
    );
  });
});

describe('list actions', () => {
  it('listLeadQuotesAction retorna mapeo numerico de decimales', async () => {
    dbMock.quote.findMany.mockResolvedValue([
      {
        id: 'q1',
        quoteNumber: 'Q-2026-000001',
        status: 'BORRADOR',
        currency: 'PEN',
        taxRate: { toString: () => '0.18', valueOf: () => 0.18 },
        subtotal: { toString: () => '100.00', valueOf: () => 100 },
        taxAmount: { toString: () => '18.00', valueOf: () => 18 },
        totalAmount: { toString: () => '118.00', valueOf: () => 118 },
        leadId: LEAD_ID,
        createdById: USER_ID,
        createdBy: { name: 'Jorge', email: 'jorge@acme.com' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        validUntil: null,
        lead: { businessName: 'Acme SAC' },
      },
    ]);

    const rows = await listLeadQuotesAction(LEAD_ID, TENANT_SLUG);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalAmount).toBe(118);
  });

  it('listTenantQuotesAction retorna total y quotes', async () => {
    dbMock.quote.findMany.mockResolvedValue([]);
    dbMock.quote.count.mockResolvedValue(0);

    const result = await listTenantQuotesAction({ tenantSlug: TENANT_SLUG, page: 1, pageSize: 20 });
    expect(result.total).toBe(0);
    expect(result.quotes).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// updateQuoteAction
// ──────────────────────────────────────────────────────────────────────────────
describe('updateQuoteAction', () => {
  const BASE_INPUT = {
    tenantSlug: TENANT_SLUG,
    quoteId: 'q1',
    leadId: LEAD_ID,
    currency: 'PEN',
    taxRate: 0.18,
    items: [{ description: 'Consultoría', quantity: 1, unitPrice: 200 }],
  };

  it('actualiza cotización propia en BORRADOR exitosamente', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      createdById: USER_ID,
      status: 'BORRADOR',
    });

    const result = await updateQuoteAction(BASE_INPUT);

    expect(result.success).toBe(true);
    expect(txMock.quote.update).toHaveBeenCalledOnce();
    expect(txMock.quoteItem.deleteMany).toHaveBeenCalledWith({ where: { quoteId: 'q1' } });
    expect(txMock.quoteItem.createMany).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('lanza 404 cuando la cotización no existe', async () => {
    dbMock.quote.findFirst.mockResolvedValue(null);

    await expect(updateQuoteAction(BASE_INPUT)).rejects.toThrow('Cotización no encontrada');
  });

  it('lanza 403 cuando vendedor intenta editar cotización ajena enviada', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      createdById: 'otro-user',
      status: 'ENVIADA',
    });

    await expect(updateQuoteAction(BASE_INPUT)).rejects.toThrow('No autorizado');
  });

  it('lanza 404 cuando el lead de destino no existe', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      createdById: USER_ID,
      status: 'BORRADOR',
    });
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(updateQuoteAction(BASE_INPUT)).rejects.toThrow('Lead no encontrado');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getQuoteDetailAction
// ──────────────────────────────────────────────────────────────────────────────
describe('getQuoteDetailAction', () => {
  const QUOTE_ROW = {
    id: 'q1',
    quoteNumber: 'Q-2026-000001',
    status: 'BORRADOR',
    currency: 'PEN',
    taxRate: { toString: () => '0.18' },
    subtotal: { toString: () => '200.00' },
    taxAmount: { toString: () => '36.00' },
    totalAmount: { toString: () => '236.00' },
    issuedAt: null,
    validUntil: null,
    notes: null,
    createdById: USER_ID,
    createdBy: { name: 'Jorge', email: 'jorge@acme.com' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    lead: { id: LEAD_ID, businessName: 'Acme SAC', ruc: '20123456789' },
    items: [
      {
        id: 'item-1',
        lineNumber: 1,
        description: 'Consultoría',
        quantity: { toString: () => '1' },
        unitPrice: { toString: () => '200.00' },
        lineSubtotal: { toString: () => '200.00' },
      },
    ],
  };

  it('retorna cotización con importes numéricos', async () => {
    dbMock.quote.findFirst.mockResolvedValue(QUOTE_ROW);

    const detail = await getQuoteDetailAction('q1', TENANT_SLUG);

    expect(detail.id).toBe('q1');
    expect(detail.totalAmount).toBe(236);
    expect(detail.items[0].unitPrice).toBe(200);
  });

  it('lanza 404 cuando la cotización no existe', async () => {
    dbMock.quote.findFirst.mockResolvedValue(null);

    await expect(getQuoteDetailAction('q1', TENANT_SLUG)).rejects.toThrow(
      'Cotización no encontrada',
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// sendQuoteEmailAction
// ──────────────────────────────────────────────────────────────────────────────
describe('sendQuoteEmailAction', () => {
  const BASE_QUOTE = {
    id: 'q1',
    quoteNumber: 'Q-2026-000001',
    status: 'BORRADOR',
    currency: 'PEN',
    taxRate: { toString: () => '0.18' },
    subtotal: { toString: () => '200.00' },
    taxAmount: { toString: () => '36.00' },
    totalAmount: { toString: () => '236.00' },
    validUntil: null,
    notes: null,
    leadId: LEAD_ID,
    lead: { businessName: 'Acme SAC' },
    items: [],
  };

  const BASE_INPUT = {
    tenantSlug: TENANT_SLUG,
    quoteId: 'q1',
    recipientEmail: 'cliente@acme.com',
  };

  it('envía email y transiciona BORRADOR → ENVIADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue(BASE_QUOTE);

    const result = await sendQuoteEmailAction(BASE_INPUT);

    expect(result.success).toBe(true);
    expect(sendQuoteEmailMock).toHaveBeenCalledOnce();
    expect(dbMock.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ENVIADA' }),
      }),
    );
  });

  it('envía email sin cambiar estado cuando ya está ENVIADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue({ ...BASE_QUOTE, status: 'ENVIADA' });

    const result = await sendQuoteEmailAction(BASE_INPUT);

    expect(result.success).toBe(true);
    expect(sendQuoteEmailMock).toHaveBeenCalledOnce();
    expect(dbMock.quote.update).not.toHaveBeenCalled();
  });

  it('lanza 400 para cotización RECHAZADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue({ ...BASE_QUOTE, status: 'RECHAZADA' });

    await expect(sendQuoteEmailAction(BASE_INPUT)).rejects.toThrow('rechazada');
  });

  it('lanza 400 para cotización ACEPTADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue({ ...BASE_QUOTE, status: 'ACEPTADA' });

    await expect(sendQuoteEmailAction(BASE_INPUT)).rejects.toThrow('aceptada');
  });

  it('lanza 404 cuando la cotización no existe', async () => {
    dbMock.quote.findFirst.mockResolvedValue(null);

    await expect(sendQuoteEmailAction(BASE_INPUT)).rejects.toThrow('Cotización no encontrada');
  });

  it('lanza 403 cuando el miembro no puede cambiar estado', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeContext('PASANTE'));
    dbMock.quote.findFirst.mockResolvedValue(BASE_QUOTE);

    await expect(sendQuoteEmailAction(BASE_INPUT)).rejects.toThrow('No autorizado');
  });
});
