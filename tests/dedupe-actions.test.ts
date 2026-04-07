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

const buildMergedLeadDataMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/dedupe-utils', () => ({ buildMergedLeadData: buildMergedLeadDataMock }));

const dbMock = vi.hoisted(() => ({
  lead: {
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  leadReassignmentRequest: {
    updateMany: vi.fn(),
  },
  interaction: {
    updateMany: vi.fn(),
  },
  document: {
    updateMany: vi.fn(),
  },
  quote: {
    updateMany: vi.fn(),
  },
  task: {
    updateMany: vi.fn(),
  },
  portalToken: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import { mergeDuplicateLeadsAction } from '@/lib/dedupe-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';

function makeTenantContext(role = 'SUPERVISOR') {
  return {
    session: { user: { id: 'u1', isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role, isActive: true },
  };
}

const PRIMARY_LEAD = {
  id: 'lead-primary',
  businessName: 'Acme Corp',
  ruc: '20123456789',
  rucNormalized: '20123456789',
  nameNormalized: 'acme corp',
  country: 'PE',
  city: 'Lima',
  industry: null,
  source: null,
  notes: null,
  phones: [],
  emails: [],
  status: 'NEW',
  ownerId: null,
  updatedAt: new Date(),
};

const DUPLICATE_LEAD = {
  ...PRIMARY_LEAD,
  id: 'lead-dup',
  businessName: 'Acme Corp Duplicado',
};

describe('mergeDuplicateLeadsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeTenantContext('SUPERVISOR'));
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findMany.mockResolvedValue([PRIMARY_LEAD, DUPLICATE_LEAD]);
    buildMergedLeadDataMock.mockReturnValue({ businessName: 'Acme Corp', status: 'NEW' });
    dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
      fn(dbMock),
    );
    dbMock.lead.update.mockResolvedValue(PRIMARY_LEAD);
    dbMock.lead.updateMany.mockResolvedValue({ count: 1 });
  });

  it('lanza AppError cuando el input es inválido (schema falla)', async () => {
    await expect(mergeDuplicateLeadsAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 403 cuando la feature DEDUPE está deshabilitada', async () => {
    assertTenantFeatureByIdMock.mockRejectedValue(new Error('Feature DEDUPE disabled'));

    await expect(
      mergeDuplicateLeadsAction({
        tenantSlug: TENANT_SLUG,
        primaryLeadId: 'lead-primary',
        duplicateLeadIds: ['lead-dup'],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 403 cuando el usuario no tiene permisos (PASANTE)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeTenantContext('PASANTE'));

    await expect(
      mergeDuplicateLeadsAction({
        tenantSlug: TENANT_SLUG,
        primaryLeadId: 'lead-primary',
        duplicateLeadIds: ['lead-dup'],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 400 cuando duplicateLeadIds no incluye leads distintos del primary', async () => {
    await expect(
      mergeDuplicateLeadsAction({
        tenantSlug: TENANT_SLUG,
        primaryLeadId: 'lead-primary',
        duplicateLeadIds: ['lead-primary'], // mismo que primary
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 404 cuando el lead principal no existe en el tenant', async () => {
    dbMock.lead.findMany.mockResolvedValue([DUPLICATE_LEAD]); // primary no encontrado

    await expect(
      mergeDuplicateLeadsAction({
        tenantSlug: TENANT_SLUG,
        primaryLeadId: 'lead-primary',
        duplicateLeadIds: ['lead-dup'],
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('fusiona los leads correctamente y revalida las vistas', async () => {
    const result = await mergeDuplicateLeadsAction({
      tenantSlug: TENANT_SLUG,
      primaryLeadId: 'lead-primary',
      duplicateLeadIds: ['lead-dup'],
    });

    expect(result).toMatchObject({ success: true });
    expect(dbMock.$transaction).toHaveBeenCalled();
    expect(dbMock.leadReassignmentRequest.updateMany).toHaveBeenCalled();
    expect(dbMock.interaction.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ['lead-dup'] } },
      data: { leadId: 'lead-primary' },
    });
    expect(dbMock.document.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ['lead-dup'] } },
      data: { leadId: 'lead-primary' },
    });
    expect(dbMock.quote.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ['lead-dup'] } },
      data: { leadId: 'lead-primary' },
    });
    expect(dbMock.task.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ['lead-dup'] } },
      data: { leadId: 'lead-primary' },
    });
    expect(dbMock.portalToken.updateMany).toHaveBeenCalledWith({
      where: { leadId: { in: ['lead-dup'] } },
      data: { leadId: 'lead-primary' },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/dedupe`);
  });
});
