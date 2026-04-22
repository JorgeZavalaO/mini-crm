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

const { parseImportCsvRecordsMock, mapCsvRecordToImportRowMock } = vi.hoisted(() => ({
  parseImportCsvRecordsMock: vi.fn(),
  mapCsvRecordToImportRowMock: vi.fn(),
}));

vi.mock('@/lib/import-utils', () => ({
  parseImportCsvRecords: parseImportCsvRecordsMock,
  mapCsvRecordToImportRow: mapCsvRecordToImportRowMock,
}));

const dbMock = vi.hoisted(() => {
  const mock = {
    lead: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    leadContact: { createMany: vi.fn(), deleteMany: vi.fn() },
    membership: { findUnique: vi.fn(), findMany: vi.fn() },
    leadOwnerHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  };

  mock.$transaction.mockImplementation((arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg as Promise<unknown>[])
      : (arg as (tx: typeof mock) => Promise<unknown>)(mock),
  );

  return mock;
});

vi.mock('@/lib/db', () => ({ db: dbMock }));

const isTenantFeatureEnabledMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/feature-service', () => ({
  isTenantFeatureEnabled: isTenantFeatureEnabledMock,
}));

import { importLeadsAction, previewImportLeadsAction } from '@/lib/import-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';
const VALID_CSV = `businessName,ruc
Empresa Alpha,20111111111
Empresa Beta,20222222222`;

function mockTransactionPassthrough() {
  dbMock.$transaction.mockImplementation((arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg as Promise<unknown>[])
      : (arg as (tx: typeof dbMock) => Promise<unknown>)(dbMock),
  );
}

function makeSupervisorContext() {
  return {
    session: { user: { id: 'u1', isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role: 'SUPERVISOR', isActive: true },
  };
}

function makeValidImportRow(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Empresa Alpha',
    ruc: '20111111111',
    country: undefined,
    city: undefined,
    industry: undefined,
    source: undefined,
    gerente: undefined,
    contactName: undefined,
    contactPhone: undefined,
    notes: undefined,
    phones: [],
    emails: [],
    contacts: [],
    hasContactColumns: false,
    status: 'NEW',
    ...overrides,
  };
}

function makeExistingLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-existing',
    businessName: 'Empresa Alpha',
    ruc: '20111111111',
    rucNormalized: '20111111111',
    ownerId: null,
    contacts: [],
    ...overrides,
  };
}

describe('previewImportLeadsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactionPassthrough();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    isTenantFeatureEnabledMock.mockResolvedValue(false);
    parseImportCsvRecordsMock.mockReturnValue([
      { businessName: 'Empresa Alpha', ruc: '20111111111' },
    ]);
    mapCsvRecordToImportRowMock.mockReturnValue(makeValidImportRow());
    dbMock.lead.findMany.mockResolvedValue([]);
    dbMock.membership.findUnique.mockResolvedValue(null);
    dbMock.membership.findMany.mockResolvedValue([]);
  });

  it('lanza AppError cuando el input es invalido', async () => {
    await expect(previewImportLeadsAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 403 cuando la feature IMPORT esta deshabilitada', async () => {
    assertTenantFeatureByIdMock.mockRejectedValue(new Error('Feature IMPORT disabled'));

    await expect(
      previewImportLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 403 cuando el usuario no tiene permiso de importar', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue({
      ...makeSupervisorContext(),
      membership: { id: 'mem-1', role: 'PASANTE', isActive: true },
    });

    await expect(
      previewImportLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('retorna el resumen de READY/SKIPPED/ERROR correctamente', async () => {
    const result = await previewImportLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV });

    expect(result.success).toBe(true);
    expect(typeof result.readyCount).toBe('number');
    expect(typeof result.skippedCount).toBe('number');
    expect(typeof result.errorCount).toBe('number');
    expect(Array.isArray(result.results)).toBe(true);
  });
});

describe('importLeadsAction create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactionPassthrough();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    isTenantFeatureEnabledMock.mockResolvedValue(false);
    parseImportCsvRecordsMock.mockReturnValue([
      { businessName: 'Empresa Alpha', ruc: '20111111111' },
    ]);
    mapCsvRecordToImportRowMock.mockReturnValue(makeValidImportRow());
    dbMock.lead.findMany.mockResolvedValue([]);
    dbMock.membership.findUnique.mockResolvedValue(null);
    dbMock.membership.findMany.mockResolvedValue([]);
    dbMock.lead.create.mockResolvedValue({ id: 'lead-new' });
  });

  it('lanza AppError 403 cuando la feature IMPORT esta deshabilitada', async () => {
    assertTenantFeatureByIdMock.mockRejectedValue(new Error('Feature IMPORT disabled'));

    await expect(
      importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('importa leads READY y retorna conteo correcto', async () => {
    const result = await importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV });

    expect(result.success).toBe(true);
    expect(result.createdCount).toBeGreaterThanOrEqual(0);
    expect(result.updatedCount).toBe(0);
    expect(typeof result.skippedCount).toBe('number');
    expect(typeof result.errorCount).toBe('number');
  });

  it('crea contactos asociados cuando el archivo trae contactos numerados', async () => {
    mapCsvRecordToImportRowMock.mockReturnValue(
      makeValidImportRow({
        contacts: [
          {
            name: 'Laura',
            phones: ['+51 944 100 200'],
            emails: ['laura@acme.com'],
            isPrimary: true,
          },
          {
            name: 'Mario',
            phones: ['+51 955 200 300'],
            emails: [],
            isPrimary: false,
          },
        ],
        hasContactColumns: true,
      }),
    );

    await importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV });

    expect(dbMock.leadContact.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            tenantId: TENANT_ID,
            leadId: 'lead-new',
            name: 'Laura',
            phones: ['+51 944 100 200'],
            emails: ['laura@acme.com'],
            isPrimary: true,
          }),
          expect.objectContaining({
            tenantId: TENANT_ID,
            leadId: 'lead-new',
            name: 'Mario',
            phones: ['+51 955 200 300'],
            isPrimary: false,
          }),
        ]),
      }),
    );
  });

  it('llama a revalidatePath cuando al menos un lead se creo', async () => {
    await importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV });

    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('lanza cuando la transaccion de creacion falla', async () => {
    dbMock.lead.create.mockRejectedValue(new Error('DB error'));
    dbMock.$transaction.mockRejectedValue(new Error('DB error'));

    await expect(
      importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toThrow('DB error');
  });
});

describe('importLeadsAction update mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactionPassthrough();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    isTenantFeatureEnabledMock.mockResolvedValue(false);
    parseImportCsvRecordsMock.mockReturnValue([
      { businessName: 'Empresa Alpha', ruc: '20111111111' },
    ]);
    mapCsvRecordToImportRowMock.mockReturnValue(
      makeValidImportRow({ city: 'Lima', status: undefined }),
    );
    dbMock.lead.findMany.mockResolvedValue([makeExistingLead()]);
    dbMock.membership.findUnique.mockResolvedValue(null);
    dbMock.membership.findMany.mockResolvedValue([]);
    dbMock.lead.update.mockResolvedValue({ id: 'lead-existing' });
  });

  it('actualiza un lead existente por RUC', async () => {
    mapCsvRecordToImportRowMock.mockReturnValue(
      makeValidImportRow({
        businessName: 'Empresa Alpha Actualizada',
        city: 'Lima',
        status: undefined,
      }),
    );

    const result = await importLeadsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
      mode: 'UPDATE_BY_RUC',
    });

    expect(result.success).toBe(true);
    expect(result.createdCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(dbMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-existing', tenantId: TENANT_ID },
        data: expect.objectContaining({
          businessName: 'Empresa Alpha Actualizada',
          city: 'Lima',
          importedById: 'u1',
          importedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('omite una fila de actualizacion cuando el RUC no existe', async () => {
    dbMock.lead.findMany.mockResolvedValue([]);

    const result = await importLeadsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
      mode: 'UPDATE_BY_RUC',
    });

    expect(result.updatedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.results[0]).toMatchObject({
      outcome: 'SKIPPED',
      message: 'No existe un lead activo con ese RUC',
    });
    expect(dbMock.lead.update).not.toHaveBeenCalled();
  });

  it('omite RUC duplicado dentro del archivo en modo actualizacion', async () => {
    parseImportCsvRecordsMock.mockReturnValue([
      { businessName: 'Empresa Alpha', ruc: '20111111111' },
      { businessName: 'Empresa Alpha repetida', ruc: '20111111111' },
    ]);
    mapCsvRecordToImportRowMock.mockImplementation((record: Record<string, string>) =>
      makeValidImportRow({
        businessName: record.businessName,
        ruc: record.ruc,
        city: 'Lima',
        status: undefined,
      }),
    );

    const result = await importLeadsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
      mode: 'UPDATE_BY_RUC',
    });

    expect(result.updatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(dbMock.lead.update).toHaveBeenCalledTimes(1);
    expect(result.results[1]).toMatchObject({
      outcome: 'SKIPPED',
      message: 'Duplicado dentro del mismo archivo por RUC',
    });
  });

  it('ignora celdas vacias para no sobrescribir datos existentes', async () => {
    mapCsvRecordToImportRowMock.mockReturnValue(
      makeValidImportRow({
        businessName: undefined,
        city: 'Lima',
        phones: [],
        emails: [],
        status: undefined,
      }),
    );

    await importLeadsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
      mode: 'UPDATE_BY_RUC',
    });

    const updateData = dbMock.lead.update.mock.calls[0][0].data;
    expect(updateData.city).toBe('Lima');
    expect(updateData.businessName).toBeUndefined();
    expect(updateData.status).toBeUndefined();
    expect(updateData.phones).toBeUndefined();
    expect(updateData.emails).toBeUndefined();
    expect(dbMock.leadContact.deleteMany).not.toHaveBeenCalled();
  });

  it('reemplaza contactos en actualizacion por RUC cuando la fila trae contactos con datos', async () => {
    mapCsvRecordToImportRowMock.mockReturnValue(
      makeValidImportRow({
        businessName: undefined,
        city: undefined,
        status: undefined,
        contacts: [
          {
            name: 'Laura',
            phones: ['+51 944 100 200', '+51 944 100 201'],
            emails: ['laura@acme.com'],
            isPrimary: true,
          },
          {
            name: 'Mario',
            phones: ['+51 955 200 300'],
            emails: [],
            isPrimary: false,
          },
        ],
        hasContactColumns: true,
      }),
    );

    const result = await importLeadsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
      mode: 'UPDATE_BY_RUC',
    });

    expect(result.updatedCount).toBe(1);
    expect(dbMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactName: 'Laura',
          contactPhone: '+51 944 100 200',
        }),
      }),
    );
    expect(dbMock.leadContact.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, leadId: 'lead-existing' },
    });
    expect(dbMock.leadContact.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            leadId: 'lead-existing',
            name: 'Laura',
            phones: ['+51 944 100 200', '+51 944 100 201'],
            emails: ['laura@acme.com'],
          }),
          expect.objectContaining({
            leadId: 'lead-existing',
            name: 'Mario',
            phones: ['+51 955 200 300'],
          }),
        ]),
      }),
    );
  });

  it('mantiene telefonos y correos existentes cuando esas celdas de contacto vienen vacias', async () => {
    dbMock.lead.findMany.mockResolvedValue([
      makeExistingLead({
        contacts: [
          {
            name: 'Laura antigua',
            phones: ['+51 944 100 200'],
            emails: ['laura@acme.com'],
            role: 'Compras',
            notes: 'Prefiere WhatsApp',
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      }),
    ]);
    mapCsvRecordToImportRowMock.mockReturnValue(
      makeValidImportRow({
        businessName: undefined,
        city: undefined,
        status: undefined,
        contacts: [
          {
            name: 'Laura nueva',
            phones: [],
            emails: [],
            isPrimary: true,
          },
        ],
        hasContactColumns: true,
      }),
    );

    await importLeadsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
      mode: 'UPDATE_BY_RUC',
    });

    expect(dbMock.leadContact.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'Laura nueva',
            phones: ['+51 944 100 200'],
            emails: ['laura@acme.com'],
            role: 'Compras',
            notes: 'Prefiere WhatsApp',
          }),
        ]),
      }),
    );
  });

  it('crea historial cuando la actualizacion cambia el owner', async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true);
    dbMock.membership.findMany.mockResolvedValue([
      { role: 'VENDEDOR', user: { id: 'owner-new', email: 'owner@acme.com' } },
    ]);
    mapCsvRecordToImportRowMock.mockReturnValue(
      makeValidImportRow({
        businessName: undefined,
        ownerEmail: 'owner@acme.com',
        status: undefined,
      }),
    );
    dbMock.lead.findMany.mockResolvedValue([makeExistingLead({ ownerId: 'owner-old' })]);

    const result = await importLeadsAction({
      tenantSlug: TENANT_SLUG,
      csvText: VALID_CSV,
      mode: 'UPDATE_BY_RUC',
    });

    expect(result.updatedCount).toBe(1);
    expect(dbMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'owner-new' }),
      }),
    );
    expect(dbMock.leadOwnerHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-existing',
          tenantId: TENANT_ID,
          previousOwnerId: 'owner-old',
          newOwnerId: 'owner-new',
          changedById: 'u1',
        }),
      }),
    );
  });
});
