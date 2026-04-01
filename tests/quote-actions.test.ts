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

const dbMock = vi.hoisted(() => ({
  quote: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  quoteItem: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
  interaction: {
    create: vi.fn(),
  },
  membership: {
    findMany: vi.fn(),
  },
  notification: {
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  changeQuoteStatusAction,
  createQuoteAction,
  deleteQuoteAction,
  listLeadQuotesAction,
  listTenantQuotesAction,
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
  dbMock.quote.count.mockResolvedValue(0);
  dbMock.quote.findFirst.mockResolvedValue(null);
  dbMock.quote.create.mockResolvedValue({ id: 'quote-1' });
  dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
  dbMock.interaction.create.mockResolvedValue({ id: 'int-1' });
  dbMock.membership.findMany.mockResolvedValue([]);
  dbMock.notification.createMany.mockResolvedValue({ count: 0 });
  dbMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      quote: { update: vi.fn() },
      quoteItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    } as unknown),
  );
});

describe('createQuoteAction', () => {
  it('crea cotización válida y revalida rutas', async () => {
    const result = await createQuoteAction({
      tenantSlug: TENANT_SLUG,
      leadId: LEAD_ID,
      currency: 'PEN',
      taxRate: 0.18,
      items: [{ description: 'Servicio mensual', quantity: 2, unitPrice: 100 }],
    });

    expect(result.success).toBe(true);
    expect(dbMock.quote.create).toHaveBeenCalledOnce();
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
  it('permite transición BORRADOR -> ENVIADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      status: 'BORRADOR',
      quoteNumber: 'COT-001',
    });

    await expect(
      changeQuoteStatusAction({ tenantSlug: TENANT_SLUG, quoteId: 'q1', status: 'ENVIADA' }),
    ).resolves.not.toThrow();

    expect(dbMock.quote.update).toHaveBeenCalledOnce();
  });

  it('bloquea transición inválida BORRADOR -> ACEPTADA', async () => {
    dbMock.quote.findFirst.mockResolvedValue({
      id: 'q1',
      leadId: LEAD_ID,
      status: 'BORRADOR',
      quoteNumber: 'COT-001',
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
  it('listLeadQuotesAction retorna mapeo numérico de decimales', async () => {
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
