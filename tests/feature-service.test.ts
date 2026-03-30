import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  tenantFeature: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
  planFeature: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  getTenantFeatureMap,
  isTenantFeatureEnabled,
  materializeTenantFeaturesFromPlan,
} from '@/lib/feature-service';

const TENANT_ID = 'tenant-abc';
const PLAN_ID = 'plan-xyz';

describe('getTenantFeatureMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // count > 0 para omitir el paso ensureTenantFeatureRows
    dbMock.tenantFeature.count.mockResolvedValue(5);
  });

  it('retorna un mapa con las features activas en true y el resto en false', async () => {
    dbMock.tenantFeature.findMany.mockResolvedValue([
      { featureKey: 'CRM_LEADS', enabled: true },
      { featureKey: 'IMPORT', enabled: true },
      { featureKey: 'DEDUPE', enabled: false },
    ]);

    const map = await getTenantFeatureMap(TENANT_ID);

    expect(map.CRM_LEADS).toBe(true);
    expect(map.IMPORT).toBe(true);
    expect(map.DEDUPE).toBe(false);
    // Features no presentes en las filas DB deben ser false por defecto
    expect(map.ASSIGNMENTS).toBe(false);
    expect(map.DOCUMENTS).toBe(false);
  });

  it('retorna todas las features en false cuando no hay filas', async () => {
    dbMock.tenantFeature.findMany.mockResolvedValue([]);

    const map = await getTenantFeatureMap(TENANT_ID);

    expect(Object.values(map).every((v) => v === false)).toBe(true);
  });

  it('llama a findMany con el tenantId correcto', async () => {
    dbMock.tenantFeature.findMany.mockResolvedValue([]);

    await getTenantFeatureMap(TENANT_ID);

    expect(dbMock.tenantFeature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
  });
});

describe('isTenantFeatureEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.tenantFeature.count.mockResolvedValue(5);
  });

  it('retorna true cuando la feature tiene enabled: true', async () => {
    dbMock.tenantFeature.findUnique.mockResolvedValue({ enabled: true });

    const result = await isTenantFeatureEnabled(TENANT_ID, 'IMPORT');

    expect(result).toBe(true);
  });

  it('retorna false cuando la feature tiene enabled: false', async () => {
    dbMock.tenantFeature.findUnique.mockResolvedValue({ enabled: false });

    const result = await isTenantFeatureEnabled(TENANT_ID, 'IMPORT');

    expect(result).toBe(false);
  });

  it('retorna false cuando no existe la fila de feature', async () => {
    dbMock.tenantFeature.findUnique.mockResolvedValue(null);

    const result = await isTenantFeatureEnabled(TENANT_ID, 'IMPORT');

    expect(result).toBe(false);
  });

  it('consulta por tenantId y featureKey correctos', async () => {
    dbMock.tenantFeature.findUnique.mockResolvedValue({ enabled: true });

    await isTenantFeatureEnabled(TENANT_ID, 'DEDUPE');

    expect(dbMock.tenantFeature.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_featureKey: { tenantId: TENANT_ID, featureKey: 'DEDUPE' } },
      }),
    );
  });
});

describe('materializeTenantFeaturesFromPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.planFeature.findMany.mockResolvedValue([
      { featureKey: 'CRM_LEADS', enabled: true, config: null },
      { featureKey: 'IMPORT', enabled: true, config: null },
    ]);
    dbMock.tenantFeature.upsert.mockResolvedValue({});
    dbMock.$transaction.mockResolvedValue([]);
  });

  it('consulta las features del plan y lanza la transacción', async () => {
    await materializeTenantFeaturesFromPlan(TENANT_ID, PLAN_ID, false);

    expect(dbMock.planFeature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { planId: PLAN_ID } }),
    );
    expect(dbMock.$transaction).toHaveBeenCalled();
  });

  it('llama a upsert para cada feature key al materializar', async () => {
    await materializeTenantFeaturesFromPlan(TENANT_ID, PLAN_ID, true);

    // $transaction recibe el array de upserts generados por FEATURE_KEYS.map(...)
    // Verificamos que upsert fue llamado por cada key (11 features)
    expect(dbMock.tenantFeature.upsert).toHaveBeenCalledTimes(11);
  });
});
