import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPortalToken } from '@/lib/portal-tokens';

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
    findFirst: vi.fn(),
  },
  portalToken: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  quote: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  createPortalTokenAction,
  revokePortalTokenAction,
  listLeadPortalTokensAction,
  getPortalDataByToken,
} from '@/lib/portal-actions';

const TENANT_ID = 'tenant-t1';
const TENANT_SLUG = 'acme';
const USER_ID = 'user-a';
const LEAD_ID = 'lead-1';
const TOKEN_ID = 'tok-1';

function makeAdminContext(userId = USER_ID) {
  return {
    session: { user: { id: userId, isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role: 'ADMIN', isActive: true },
  };
}

function makeMemberContext(userId = USER_ID) {
  return {
    session: { user: { id: userId, isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-2', role: 'PASANTE', isActive: true },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTenantActionContextBySlugMock.mockResolvedValue(makeAdminContext());
  assertTenantFeatureByIdMock.mockResolvedValue(undefined);
  dbMock.quote.count.mockResolvedValue(1);
});

describe('createPortalTokenAction', () => {
  it('crea un token de portal y solo persiste el hash', async () => {
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
    dbMock.portalToken.create.mockResolvedValue({ id: TOKEN_ID });

    const result = await createPortalTokenAction({
      tenantSlug: TENANT_SLUG,
      leadId: LEAD_ID,
    });

    expect(result.success).toBe(true);
    expect(result.tokenId).toBe(TOKEN_ID);
    expect(result.token).toHaveLength(64);
    expect(result.expiresAt).toBeTruthy();
    expect(dbMock.portalToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_ID,
        leadId: LEAD_ID,
        createdById: USER_ID,
        tokenHash: hashPortalToken(result.token),
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });

  it('lanza 404 si el lead no existe', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);
    await expect(
      createPortalTokenAction({ tenantSlug: TENANT_SLUG, leadId: 'nope' }),
    ).rejects.toThrow('Lead no encontrado');
  });

  it('lanza 403 para miembros sin permiso', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeMemberContext());
    await expect(
      createPortalTokenAction({ tenantSlug: TENANT_SLUG, leadId: LEAD_ID }),
    ).rejects.toThrow('No autorizado');
  });
});

describe('revokePortalTokenAction', () => {
  it('revoca un token activo', async () => {
    dbMock.portalToken.findFirst.mockResolvedValue({ id: TOKEN_ID, leadId: LEAD_ID });
    dbMock.portalToken.update.mockResolvedValue({});

    const result = await revokePortalTokenAction({
      tenantSlug: TENANT_SLUG,
      tokenId: TOKEN_ID,
    });

    expect(result.success).toBe(true);
    expect(dbMock.portalToken.update).toHaveBeenCalledWith({
      where: { id: TOKEN_ID },
      data: { isActive: false },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });
});

describe('listLeadPortalTokensAction', () => {
  it('lista solo metadatos del lead sin exponer el token', async () => {
    const tokens = [
      {
        id: TOKEN_ID,
        isActive: true,
        expiresAt: null,
        lastAccessedAt: null,
        createdAt: new Date(),
        createdBy: { name: 'Admin', email: 'admin@test.com' },
      },
    ];
    dbMock.portalToken.findMany.mockResolvedValue(tokens);

    const result = await listLeadPortalTokensAction({
      tenantSlug: TENANT_SLUG,
      leadId: LEAD_ID,
    });

    expect(result).toEqual(tokens);
    expect(result[0]).not.toHaveProperty('token');
  });

  it('bloquea el listado a roles sin permiso', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeMemberContext());

    await expect(
      listLeadPortalTokensAction({
        tenantSlug: TENANT_SLUG,
        leadId: LEAD_ID,
      }),
    ).rejects.toThrow('No autorizado para ver tokens de portal');
  });
});

describe('getPortalDataByToken', () => {
  it('busca usando tokenHash, actualiza lastAccessedAt y devuelve cotizaciones visibles', async () => {
    const rawToken = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    dbMock.portalToken.findUnique.mockResolvedValue({
      id: TOKEN_ID,
      isActive: true,
      expiresAt: null,
      tenantId: TENANT_ID,
      leadId: LEAD_ID,
      tenant: { name: 'Acme Corp' },
      lead: { businessName: 'Juan Corp', emails: ['juan@test.com'], deletedAt: null },
    });
    dbMock.portalToken.update.mockResolvedValue({});
    dbMock.quote.findMany.mockResolvedValue([
      {
        id: 'q1',
        quoteNumber: 'Q-2026-000001',
        status: 'ENVIADA',
        totalAmount: 1000,
        currency: 'USD',
        issuedAt: null,
        validUntil: null,
        createdAt: new Date(),
        items: [{ description: 'Item 1', quantity: 1, unitPrice: 1000, lineSubtotal: 1000 }],
      },
    ]);

    const result = await getPortalDataByToken(rawToken);

    expect(result).not.toBeNull();
    expect(result!.quotes).toHaveLength(1);
    expect(dbMock.portalToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashPortalToken(rawToken) },
      select: expect.any(Object),
    });
    expect(dbMock.portalToken.update).toHaveBeenCalledWith({
      where: { id: TOKEN_ID },
      data: { lastAccessedAt: expect.any(Date) },
    });
  });

  it('devuelve null si el token no existe', async () => {
    dbMock.portalToken.findUnique.mockResolvedValue(null);
    const result = await getPortalDataByToken('invalid-token');
    expect(result).toBeNull();
  });
});
