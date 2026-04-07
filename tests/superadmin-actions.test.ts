import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, revalidatePathMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const materializeTenantFeaturesFromPlanMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/feature-service', () => ({
  materializeTenantFeaturesFromPlan: materializeTenantFeaturesFromPlanMock,
}));

vi.mock('@/lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed-pw') }));

const dbMock = vi.hoisted(() => ({
  plan: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  planFeature: {
    create: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tenantFeature: {
    create: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  membership: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  createPlanAction,
  createTenantAction,
  restoreTenantAction,
  setTenantFeatureAction,
  softDeleteTenantAction,
  togglePlanAction,
  toggleTenantAction,
  updatePlanAction,
  updateTenantBasicsAction,
  updateTenantPlanAndLimitsAction,
} from '@/lib/superadmin-actions';

function makeSuperAdminSession() {
  return { user: { id: 'sa-1', isSuperAdmin: true } };
}

function makePlanFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set('name', 'Plan Pro');
  fd.set('maxUsers', '10');
  fd.set('maxStorageGb', '20');
  fd.set('retentionDays', '90');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

function makeTenantFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set('companyName', 'Empresa Test');
  fd.set('slug', 'empresa-test');
  fd.set('adminName', 'Admin User');
  fd.set('adminEmail', 'admin@empresa-test.com');
  fd.set('adminPassword', 'password123');
  fd.set('planId', 'plan-1');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

const ACTIVE_PLAN = {
  id: 'plan-1',
  name: 'Plan Pro',
  isActive: true,
  maxUsers: 10,
  maxStorageGb: 20,
  retentionDays: 90,
};

describe('createPlanAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.plan.findUnique.mockResolvedValue(null); // nombre disponible
    dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
      fn(dbMock),
    );
    dbMock.plan.create.mockResolvedValue({ id: 'plan-new' });
    dbMock.planFeature.create.mockResolvedValue({});
  });

  it('retorna error cuando no se es superadmin', async () => {
    authMock.mockResolvedValue({ user: { isSuperAdmin: false } });

    await expect(createPlanAction(undefined, makePlanFormData())).rejects.toThrow('No autorizado');
  });

  it('retorna error cuando faltan campos requeridos', async () => {
    const result = await createPlanAction(undefined, new FormData());

    expect(result.error).toBeDefined();
  });

  it('retorna error cuando el nombre del plan ya existe', async () => {
    dbMock.plan.findUnique.mockResolvedValue(ACTIVE_PLAN);

    const result = await createPlanAction(undefined, makePlanFormData());

    expect(result.error).toMatch(/ya existe un plan/i);
  });

  it('crea el plan y retorna success', async () => {
    const result = await createPlanAction(undefined, makePlanFormData());

    expect(result.success).toBeDefined();
    expect(dbMock.$transaction).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/superadmin/plans');
  });
});

describe('updatePlanAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
      fn(dbMock),
    );
    dbMock.plan.update.mockResolvedValue(ACTIVE_PLAN);
    dbMock.planFeature.upsert.mockResolvedValue({});
  });

  it('retorna error cuando faltan planId u otros campos obligatorios', async () => {
    const result = await updatePlanAction(undefined, new FormData());

    expect(result.error).toBeDefined();
  });

  it('actualiza el plan correctamente y retorna success', async () => {
    const fd = makePlanFormData({ planId: 'plan-1' });

    const result = await updatePlanAction(undefined, fd);

    expect(result.success).toBeDefined();
    expect(dbMock.$transaction).toHaveBeenCalled();
  });
});

describe('togglePlanAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.plan.update.mockResolvedValue({ ...ACTIVE_PLAN, isActive: false });
  });

  it('lanza error cuando el plan no existe', async () => {
    dbMock.plan.findUnique.mockResolvedValue(null);

    await expect(togglePlanAction('nonexistent')).rejects.toThrow('Plan no encontrado');
  });

  it('desactiva un plan activo y retorna el nuevo estado', async () => {
    dbMock.plan.findUnique.mockResolvedValue(ACTIVE_PLAN);

    const result = await togglePlanAction('plan-1');

    expect(result.success).toBe(true);
    expect(result.isActive).toBe(false);
  });
});

describe('createTenantAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.plan.findUnique.mockResolvedValue(ACTIVE_PLAN);
    dbMock.tenant.findUnique.mockResolvedValue(null); // slug disponible
    dbMock.user.findUnique.mockResolvedValue(null); // email disponible
    dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
      fn(dbMock),
    );
    dbMock.tenant.create.mockResolvedValue({ id: 'tenant-new', slug: 'empresa-test' });
    dbMock.user.create.mockResolvedValue({ id: 'user-new' });
    dbMock.membership.create.mockResolvedValue({});
    dbMock.planFeature.findMany.mockResolvedValue([]);
  });

  it('retorna error cuando faltan campos requeridos', async () => {
    const result = await createTenantAction(undefined, new FormData());

    expect(result.error).toBeDefined();
  });

  it('retorna error cuando el slug ya existe', async () => {
    dbMock.tenant.findUnique.mockResolvedValue({ id: 'existing' });

    const result = await createTenantAction(undefined, makeTenantFormData());

    expect(result.error).toMatch(/slug/i);
  });

  it('retorna error cuando el email del admin ya existe', async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    const result = await createTenantAction(undefined, makeTenantFormData());

    expect(result.error).toMatch(/usuario/i);
  });

  it('retorna error cuando el slug tiene formato inválido', async () => {
    const result = await createTenantAction(
      undefined,
      makeTenantFormData({ slug: 'Slug Con Mayusculas' }),
    );

    expect(result.error).toMatch(/slug/i);
  });

  it('crea el tenant correctamente y retorna success', async () => {
    const result = await createTenantAction(undefined, makeTenantFormData());

    expect(result.success).toBeDefined();
    expect(dbMock.$transaction).toHaveBeenCalled();
  });
});

describe('updateTenantBasicsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.tenant.findUnique.mockResolvedValue(null); // slug disponible para otro tenant
    dbMock.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      slug: 'nuevo-slug',
      name: 'Nuevo Nombre',
    });
    // Para revalidateTenantViews
    dbMock.tenant.findUnique.mockResolvedValue(null);
  });

  it('retorna error cuando faltan nombre o slug', async () => {
    const result = await updateTenantBasicsAction(undefined, new FormData());

    expect(result.error).toBeDefined();
  });

  it('retorna error si el slug ya está en uso por otro tenant', async () => {
    dbMock.tenant.findUnique.mockResolvedValue({ id: 'otro-tenant' });

    const fd = new FormData();
    fd.set('tenantId', 'tenant-1');
    fd.set('name', 'Mi Empresa');
    fd.set('slug', 'slug-existente');

    const result = await updateTenantBasicsAction(undefined, fd);

    expect(result.error).toMatch(/slug/i);
  });
});

describe('toggleTenantAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.tenant.update.mockResolvedValue({ id: 'tenant-1', isActive: false, name: 'Acme' });
  });

  it('lanza error cuando el tenant no existe', async () => {
    dbMock.tenant.findUnique.mockResolvedValue(null);

    await expect(toggleTenantAction('nonexistent')).rejects.toThrow('Tenant no encontrado');
  });

  it('lanza error cuando el tenant ya fue eliminado (softDelete)', async () => {
    dbMock.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      isActive: true,
      name: 'Acme',
      deletedAt: new Date(),
    });

    await expect(toggleTenantAction('tenant-1')).rejects.toThrow();
  });

  it('desactiva un tenant activo y retorna el nuevo estado', async () => {
    dbMock.tenant.findUnique
      .mockResolvedValueOnce({ id: 'tenant-1', isActive: true, name: 'Acme', deletedAt: null })
      .mockResolvedValue(null); // para revalidateTenantViews

    const result = await toggleTenantAction('tenant-1');

    expect(result.success).toBe(true);
    expect(result.isActive).toBe(false);
    expect(result.name).toBe('Acme');
  });
});

describe('softDeleteTenantAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.tenant.update.mockResolvedValue({ id: 'tenant-1' });
  });

  it('lanza error cuando el tenant no existe', async () => {
    dbMock.tenant.findUnique.mockResolvedValue(null);

    await expect(softDeleteTenantAction('nonexistent')).rejects.toThrow('Tenant no encontrado');
  });

  it('marca el tenant como eliminado y lo desactiva', async () => {
    dbMock.tenant.findUnique
      .mockResolvedValueOnce({ id: 'tenant-1', name: 'Acme' })
      .mockResolvedValue(null);

    const result = await softDeleteTenantAction('tenant-1');

    expect(result.success).toBe(true);
    expect(dbMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
  });
});

describe('restoreTenantAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.tenant.update.mockResolvedValue({ id: 'tenant-1' });
  });

  it('lanza error cuando el tenant no existe', async () => {
    dbMock.tenant.findUnique.mockResolvedValue(null);

    await expect(restoreTenantAction('nonexistent')).rejects.toThrow('Tenant no encontrado');
  });

  it('restaura el tenant limpiando deletedAt y activando isActive en true', async () => {
    dbMock.tenant.findUnique
      .mockResolvedValueOnce({ id: 'tenant-1', deletedAt: new Date() })
      .mockResolvedValue(null);

    const result = await restoreTenantAction('tenant-1');

    expect(result.success).toBe(true);
    expect(dbMock.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: null, isActive: true }),
      }),
    );
  });
});

describe('updateTenantPlanAndLimitsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.plan.findUnique.mockResolvedValue(ACTIVE_PLAN);
    dbMock.tenant.update.mockResolvedValue({ id: 'tenant-1' });
    dbMock.tenant.findUnique.mockResolvedValue(null);
    materializeTenantFeaturesFromPlanMock.mockResolvedValue(undefined);
  });

  it('retorna error cuando faltan campos requeridos', async () => {
    const result = await updateTenantPlanAndLimitsAction(undefined, new FormData());

    expect(result.error).toBeDefined();
  });

  it('retorna error cuando el plan no existe', async () => {
    dbMock.plan.findUnique.mockResolvedValue(null);

    const fd = new FormData();
    fd.set('tenantId', 'tenant-1');
    fd.set('planId', 'plan-inexistente');
    fd.set('maxUsers', '10');
    fd.set('maxStorageGb', '20');
    fd.set('retentionDays', '90');

    const result = await updateTenantPlanAndLimitsAction(undefined, fd);

    expect(result.error).toMatch(/plan/i);
  });

  it('actualiza el plan del tenant y materializa features', async () => {
    const fd = new FormData();
    fd.set('tenantId', 'tenant-1');
    fd.set('planId', 'plan-1');
    fd.set('maxUsers', '10');
    fd.set('maxStorageGb', '20');
    fd.set('retentionDays', '90');

    const result = await updateTenantPlanAndLimitsAction(undefined, fd);

    expect(result.success).toBeDefined();
    expect(materializeTenantFeaturesFromPlanMock).toHaveBeenCalledWith('tenant-1', 'plan-1', false);
  });
});

describe('setTenantFeatureAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.tenantFeature.upsert.mockResolvedValue({});
    dbMock.tenant.findUnique.mockResolvedValue(null);
  });

  it('lanza error cuando la feature no está soportada en esta versión', async () => {
    await expect(
      setTenantFeatureAction('tenant-1', 'UNKNOWN_FEATURE' as never, true),
    ).rejects.toThrow(/no esta disponible/i);
  });

  it('lanza error cuando el config JSON es inválido', async () => {
    await expect(
      setTenantFeatureAction('tenant-1', 'IMPORT', true, '{ invalid json }'),
    ).rejects.toThrow(/JSON/i);
  });

  it('habilita una feature soportada sin error', async () => {
    const result = await setTenantFeatureAction('tenant-1', 'IMPORT', true);

    expect(result).toEqual({ success: true });
    expect(dbMock.tenantFeature.upsert).toHaveBeenCalled();
  });

  it('deshabilita una feature soportada sin error', async () => {
    const result = await setTenantFeatureAction('tenant-1', 'DEDUPE', false);

    expect(result).toEqual({ success: true });
  });
});
