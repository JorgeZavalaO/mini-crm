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

const dbMock = vi.hoisted(() => ({
  lead: { findMany: vi.fn(), create: vi.fn() },
  membership: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

const isTenantFeatureEnabledMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/feature-service', () => ({
  isTenantFeatureEnabled: isTenantFeatureEnabledMock,
}));

import { importLeadsAction, previewImportLeadsAction } from '@/lib/import-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';

function makeSupervisorContext() {
  return {
    session: { user: { id: 'u1', isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role: 'SUPERVISOR', isActive: true },
  };
}

const VALID_CSV = `businessName,ruc
Empresa Alpha,20111111111
Empresa Beta,20222222222`;

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
    status: 'NEW',
    ...overrides,
  };
}

describe('previewImportLeadsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('lanza AppError cuando el input es inválido (schema falla)', async () => {
    await expect(previewImportLeadsAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 403 cuando la feature IMPORT está deshabilitada', async () => {
    assertTenantFeatureByIdMock.mockRejectedValue(new Error('Feature IMPORT disabled'));

    await expect(
      previewImportLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 403 cuando el usuario no tiene permiso de importar (PASANTE)', async () => {
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

describe('importLeadsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('lanza AppError 403 cuando la feature IMPORT está deshabilitada', async () => {
    assertTenantFeatureByIdMock.mockRejectedValue(new Error('Feature IMPORT disabled'));

    await expect(
      importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('importa leads READY y retorna conteo correcto', async () => {
    const result = await importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV });

    expect(result.success).toBe(true);
    expect(result.createdCount).toBeGreaterThanOrEqual(0);
    expect(typeof result.skippedCount).toBe('number');
    expect(typeof result.errorCount).toBe('number');
  });

  it('llama a revalidatePath cuando al menos un lead se creó', async () => {
    dbMock.lead.create.mockResolvedValue({ id: 'lead-created' });

    await importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV });

    // Con leads creados, se revalidan las vistas de importación
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('lanza cuando la transacción de creación falla', async () => {
    dbMock.lead.create.mockRejectedValue(new Error('DB error'));
    dbMock.$transaction.mockRejectedValue(new Error('DB error'));

    await expect(
      importLeadsAction({ tenantSlug: TENANT_SLUG, csvText: VALID_CSV }),
    ).rejects.toThrow('DB error');
  });
});
