import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { getMock, putMock, delMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({
  get: getMock,
  put: putMock,
  del: delMock,
}));

const { getTenantActionContextBySlugMock } = vi.hoisted(() => ({
  getTenantActionContextBySlugMock: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({
  getTenantActionContextBySlug: getTenantActionContextBySlugMock,
}));

const dbMock = vi.hoisted(() => ({
  tenant: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import { getCompanyProfileAction, updateCompanyProfileAction } from '@/lib/company-actions';

const TENANT_ID = 'tenant-1';
const TENANT_SLUG = 'acme';

function makeAdminContext() {
  return {
    session: { user: { id: 'admin-1', isSuperAdmin: false } },
    tenant: {
      id: TENANT_ID,
      name: 'Acme',
      slug: TENANT_SLUG,
      isActive: true,
      companyTimezone: 'America/Lima',
      restrictLeadEditingToOwner: true,
    },
    membership: { id: 'mem-1', role: 'ADMIN', isActive: true },
  };
}

describe('company-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeAdminContext());
    getMock.mockResolvedValue(null);
    dbMock.tenant.findFirst.mockResolvedValue({
      companyName: 'Acme Logistics',
      companyRuc: '20123456789',
      companyAddress: 'Av. Principal 123',
      companyPhone: '+51 999 888 777',
      companyEmail: 'ventas@acme.test',
      companyWebsite: 'https://acme.test',
      companyLogoPathname: null,
      companyTimezone: 'America/Lima',
      restrictLeadEditingToOwner: false,
    });
    dbMock.tenant.update.mockResolvedValue({});
  });

  it('retorna la preferencia de restricción de edición de leads en el perfil de empresa', async () => {
    const profile = await getCompanyProfileAction(TENANT_SLUG);

    expect(profile.restrictLeadEditingToOwner).toBe(false);
    expect(profile.companyTimezone).toBe('America/Lima');
    expect(getMock).not.toHaveBeenCalled();
  });

  it('guarda la preferencia y revalida company, leads y quotes', async () => {
    await updateCompanyProfileAction({
      tenantSlug: TENANT_SLUG,
      companyName: 'Acme Logistics',
      companyTimezone: 'America/Lima',
      restrictLeadEditingToOwner: false,
    });

    expect(dbMock.tenant.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: expect.objectContaining({
        companyName: 'Acme Logistics',
        companyTimezone: 'America/Lima',
        restrictLeadEditingToOwner: false,
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/company`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/quotes`);
  });
});
