import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock, forbidden: vi.fn() }));

const dbMock = vi.hoisted(() => ({
  tenant: { findFirst: vi.fn() },
  membership: { findUnique: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

const isTenantFeatureEnabledMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/feature-service', () => ({
  isTenantFeatureEnabled: isTenantFeatureEnabledMock,
}));

import {
  assertTenantFeatureById,
  getTenantActionContextBySlug,
  getTenantActionContextById,
  requireSuperAdmin,
} from '@/lib/auth-guard';

const ACTIVE_TENANT = { id: 'tenant-1', name: 'Acme', slug: 'acme', isActive: true };
const ACTIVE_MEMBERSHIP = { id: 'mem-1', role: 'ADMIN', isActive: true };

describe('getTenantActionContextBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lanza AppError 401 cuando no hay sesión activa', async () => {
    authMock.mockResolvedValue(null);

    await expect(getTenantActionContextBySlug('acme')).rejects.toMatchObject({ status: 401 });
  });

  it('lanza AppError 404 cuando el tenant no existe', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isSuperAdmin: false } });
    dbMock.tenant.findFirst.mockResolvedValue(null);

    await expect(getTenantActionContextBySlug('acme')).rejects.toMatchObject({ status: 404 });
  });

  it('lanza AppError 404 cuando el tenant está inactivo', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isSuperAdmin: false } });
    dbMock.tenant.findFirst.mockResolvedValue({ ...ACTIVE_TENANT, isActive: false });

    await expect(getTenantActionContextBySlug('acme')).rejects.toMatchObject({ status: 404 });
  });

  it('retorna contexto con membership null para superadmin (bypass)', async () => {
    authMock.mockResolvedValue({ user: { id: 'sa-1', isSuperAdmin: true } });
    dbMock.tenant.findFirst.mockResolvedValue(ACTIVE_TENANT);

    const ctx = await getTenantActionContextBySlug('acme');

    expect(ctx.membership).toBeNull();
    expect(ctx.tenant.slug).toBe('acme');
    expect(dbMock.membership.findUnique).not.toHaveBeenCalled();
  });

  it('retorna contexto con membership para usuario regular activo', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isSuperAdmin: false } });
    dbMock.tenant.findFirst.mockResolvedValue(ACTIVE_TENANT);
    dbMock.membership.findUnique.mockResolvedValue(ACTIVE_MEMBERSHIP);

    const ctx = await getTenantActionContextBySlug('acme');

    expect(ctx.membership).toEqual(ACTIVE_MEMBERSHIP);
    expect(ctx.session.user.id).toBe('u1');
  });

  it('lanza AppError 403 cuando el usuario regular no tiene membresía activa', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isSuperAdmin: false } });
    dbMock.tenant.findFirst.mockResolvedValue(ACTIVE_TENANT);
    dbMock.membership.findUnique.mockResolvedValue(null);

    await expect(getTenantActionContextBySlug('acme')).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 403 cuando la membresía está inactiva', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isSuperAdmin: false } });
    dbMock.tenant.findFirst.mockResolvedValue(ACTIVE_TENANT);
    dbMock.membership.findUnique.mockResolvedValue({ ...ACTIVE_MEMBERSHIP, isActive: false });

    await expect(getTenantActionContextBySlug('acme')).rejects.toMatchObject({ status: 403 });
  });
});

describe('getTenantActionContextById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lanza AppError 401 cuando no hay sesión activa', async () => {
    authMock.mockResolvedValue(null);

    await expect(getTenantActionContextById('tenant-1')).rejects.toMatchObject({ status: 401 });
  });

  it('retorna contexto con membership null para superadmin', async () => {
    authMock.mockResolvedValue({ user: { id: 'sa-1', isSuperAdmin: true } });
    dbMock.tenant.findFirst.mockResolvedValue(ACTIVE_TENANT);

    const ctx = await getTenantActionContextById('tenant-1');

    expect(ctx.membership).toBeNull();
  });
});

describe('assertTenantFeatureById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no lanza cuando la feature está habilitada', async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(true);

    await expect(assertTenantFeatureById('tenant-1', 'IMPORT')).resolves.not.toThrow();
  });

  it('lanza un Error cuando la feature está deshabilitada', async () => {
    isTenantFeatureEnabledMock.mockResolvedValue(false);

    await expect(assertTenantFeatureById('tenant-1', 'IMPORT')).rejects.toThrow(/IMPORT disabled/);
  });
});

describe('requireSuperAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Next.js redirect() always throws — mirror that behaviour so the function stops
    redirectMock.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('llama a redirect cuando no hay sesión', async () => {
    authMock.mockResolvedValue(null);

    await expect(requireSuperAdmin()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('llama a redirect cuando el usuario no es superadmin', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', isSuperAdmin: false } });

    await expect(requireSuperAdmin()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('retorna la sesión cuando el usuario es superadmin', async () => {
    const session = { user: { id: 'sa-1', isSuperAdmin: true } };
    authMock.mockResolvedValue(session);

    const result = await requireSuperAdmin();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toEqual(session);
  });
});
