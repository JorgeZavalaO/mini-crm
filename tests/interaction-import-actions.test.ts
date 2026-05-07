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
  lead: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  membership: {
    findMany: vi.fn(),
  },
  interaction: {
    createMany: vi.fn(),
  },
  leadOwnerHistory: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  importInteractionsAction,
  previewImportInteractionsAction,
} from '@/lib/interaction-import-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';
const LEAD_ID = 'lead-1';
const AUTHOR_ID = 'author-1';
const VALID_CSV = [
  'ruc,authorEmail,type,occurredAt,subject,notes',
  '20123456789,vendedor@acme.com,CALL,2026-03-30 10:00,Llamada inicial,Cliente interesado',
].join('\n');

function makeSupervisorContext() {
  return {
    session: { user: { id: 'u1', isSuperAdmin: false } },
    tenant: {
      id: TENANT_ID,
      name: 'Acme',
      slug: TENANT_SLUG,
      isActive: true,
      companyTimezone: 'America/Lima',
    },
    membership: { id: 'mem-1', role: 'SUPERVISOR', isActive: true },
  };
}

function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAD_ID,
    businessName: 'Empresa Alpha',
    rucNormalized: '20123456789',
    ...overrides,
  };
}

function makeAuthorMembership(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: AUTHOR_ID, email: 'vendedor@acme.com' },
    ...overrides,
  };
}

describe('previewImportInteractionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findMany.mockResolvedValue([makeLead()]);
    dbMock.membership.findMany.mockResolvedValue([makeAuthorMembership()]);
    dbMock.interaction.createMany.mockResolvedValue({ count: 1 });
  });

  it('lanza AppError cuando el input es invalido', async () => {
    await expect(previewImportInteractionsAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 403 cuando alguna feature requerida esta deshabilitada', async () => {
    assertTenantFeatureByIdMock.mockImplementation((tenantId: string, featureKey: string) => {
      if (featureKey === 'INTERACTIONS') throw new Error('disabled');
      return Promise.resolve(undefined);
    });

    await expect(
      previewImportInteractionsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 403 cuando el usuario no puede importar', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue({
      ...makeSupervisorContext(),
      membership: { id: 'mem-1', role: 'PASANTE', isActive: true },
    });

    await expect(
      previewImportInteractionsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('marca como omitida la fila cuando el RUC no existe', async () => {
    dbMock.lead.findMany.mockResolvedValue([]);

    const result = await previewImportInteractionsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
    });

    expect(result.readyCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.results[0]).toMatchObject({
      outcome: 'SKIPPED',
      message: 'No existe un lead activo con ese RUC',
    });
  });

  it('marca error cuando el RUC es ambiguo dentro del tenant', async () => {
    dbMock.lead.findMany.mockResolvedValue([
      makeLead({ id: 'lead-1' }),
      makeLead({ id: 'lead-2', businessName: 'Empresa Alpha duplicada' }),
    ]);

    const result = await previewImportInteractionsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
    });

    expect(result.readyCount).toBe(0);
    expect(result.errorCount).toBe(1);
    expect(result.results[0].message).toMatch(/ambiguo/i);
  });

  it('marca error cuando authorEmail no pertenece a un miembro activo', async () => {
    dbMock.membership.findMany.mockResolvedValue([]);

    const result = await previewImportInteractionsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
    });

    expect(result.readyCount).toBe(0);
    expect(result.errorCount).toBe(1);
    expect(result.results[0].message).toMatch(/miembro activo/i);
  });

  it('retorna una fila lista con la fecha historica normalizada', async () => {
    const result = await previewImportInteractionsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
    });

    expect(result.readyCount).toBe(1);
    expect(result.results[0]).toMatchObject({
      outcome: 'READY',
      ruc: '20123456789',
      businessName: 'Empresa Alpha',
      authorEmail: 'vendedor@acme.com',
      type: 'CALL',
      occurredAt: '2026-03-30T15:00:00.000Z',
    });
  });
});

describe('importInteractionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findMany.mockResolvedValue([makeLead()]);
    dbMock.membership.findMany.mockResolvedValue([makeAuthorMembership()]);
    dbMock.interaction.createMany.mockResolvedValue({ count: 1 });
  });

  it('crea solo interacciones y no muta lead status, owner ni historial', async () => {
    const result = await importInteractionsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
    });

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(1);
    expect(dbMock.interaction.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          leadId: LEAD_ID,
          tenantId: TENANT_ID,
          authorId: AUTHOR_ID,
          type: 'CALL',
          subject: 'Llamada inicial',
          notes: 'Cliente interesado',
          occurredAt: new Date('2026-03-30T15:00:00.000Z'),
        }),
      ],
    });
    expect(dbMock.lead.update).not.toHaveBeenCalled();
    expect(dbMock.leadOwnerHistory.create).not.toHaveBeenCalled();
  });

  it('revalida la lista, la pantalla de importacion y el detalle del lead', async () => {
    await importInteractionsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
    });

    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/interactions/import`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });
});
