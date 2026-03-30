import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
vi.mock('@/auth', () => ({ signIn: vi.fn() }));

const getTenantActionContextByIdMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-guard', () => ({
  getTenantActionContextById: getTenantActionContextByIdMock,
}));

const {
  createTeamInvitationTokenMock,
  getTeamInvitationExpiresAtMock,
  getTeamInvitationStatusMock,
  hashTeamInvitationTokenMock,
  isTeamInvitationPendingMock,
} = vi.hoisted(() => ({
  createTeamInvitationTokenMock: vi.fn(),
  getTeamInvitationExpiresAtMock: vi.fn(),
  getTeamInvitationStatusMock: vi.fn(),
  hashTeamInvitationTokenMock: vi.fn(),
  isTeamInvitationPendingMock: vi.fn(),
}));

vi.mock('@/lib/team-invitations', () => ({
  createTeamInvitationToken: createTeamInvitationTokenMock,
  getTeamInvitationExpiresAt: getTeamInvitationExpiresAtMock,
  getTeamInvitationStatus: getTeamInvitationStatusMock,
  hashTeamInvitationToken: hashTeamInvitationTokenMock,
  isTeamInvitationPending: isTeamInvitationPendingMock,
}));

vi.mock('@/lib/team-invite-service', () => ({
  getTeamInvitationPreviewByToken: vi.fn(),
  formatTeamInvitationDate: vi.fn().mockReturnValue('7 abr 2026'),
}));

const dbMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  membership: { count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  teamInvitation: {
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

import {
  cancelTeamInvitationAction,
  createTeamInvitationAction,
  refreshTeamInvitationLinkAction,
} from '@/lib/team-invite-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';
const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

function makeAdminContext() {
  return {
    session: { user: { id: 'admin-1', isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role: 'ADMIN', isActive: true },
  };
}

function makePendingInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    tenantId: TENANT_ID,
    email: 'invitado@acme.com',
    acceptedAt: null,
    canceledAt: null,
    expiresAt: FUTURE_DATE,
    ...overrides,
  };
}

describe('createTeamInvitationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextByIdMock.mockResolvedValue(makeAdminContext());
    dbMock.tenant.findUnique.mockResolvedValue({
      id: TENANT_ID,
      isActive: true,
      deletedAt: null,
      maxUsers: 10,
    });
    dbMock.membership.count.mockResolvedValue(2);
    dbMock.teamInvitation.count.mockResolvedValue(0);
    dbMock.membership.findFirst.mockResolvedValue(null);
    dbMock.teamInvitation.findFirst.mockResolvedValue(null);
    dbMock.teamInvitation.create.mockResolvedValue({ id: 'inv-new' });
    createTeamInvitationTokenMock.mockReturnValue({ rawToken: 'raw-abc', tokenHash: 'hash-abc' });
    getTeamInvitationExpiresAtMock.mockReturnValue(FUTURE_DATE);
  });

  it('retorna error cuando la validación del schema falla', async () => {
    const fd = new FormData();
    fd.set('tenantId', TENANT_ID);
    // falta email y role

    const result = await createTeamInvitationAction(undefined, fd);

    expect(result.error).toBeDefined();
    expect(result.success).toBeUndefined();
  });

  it('retorna error cuando el email ya tiene una membresía activa', async () => {
    dbMock.membership.findFirst.mockResolvedValue({ id: 'mem-existing', isActive: true });

    const fd = new FormData();
    fd.set('tenantId', TENANT_ID);
    fd.set('tenantSlug', TENANT_SLUG);
    fd.set('email', 'activo@acme.com');
    fd.set('role', 'VENDEDOR');

    const result = await createTeamInvitationAction(undefined, fd);

    expect(result.error).toMatch(/miembro activo/i);
  });

  it('retorna error cuando ya existe una invitación pendiente para el email', async () => {
    dbMock.teamInvitation.findFirst.mockResolvedValue({ id: 'inv-existing' });

    const fd = new FormData();
    fd.set('tenantId', TENANT_ID);
    fd.set('tenantSlug', TENANT_SLUG);
    fd.set('email', 'pendiente@acme.com');
    fd.set('role', 'VENDEDOR');

    const result = await createTeamInvitationAction(undefined, fd);

    expect(result.error).toMatch(/invitación pendiente/i);
  });

  it('crea la invitación y retorna el path del token', async () => {
    const fd = new FormData();
    fd.set('tenantId', TENANT_ID);
    fd.set('tenantSlug', TENANT_SLUG);
    fd.set('email', 'nuevo@acme.com');
    fd.set('role', 'VENDEDOR');

    const result = await createTeamInvitationAction(undefined, fd);

    expect(result.success).toBe(true);
    expect(result.invitePath).toBe('/invite/raw-abc');
    expect(result.inviteEmail).toBe('nuevo@acme.com');
    expect(dbMock.teamInvitation.create).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/team`);
  });
});

describe('cancelTeamInvitationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextByIdMock.mockResolvedValue(makeAdminContext());
    getTeamInvitationStatusMock.mockReturnValue('PENDING');
    dbMock.teamInvitation.update.mockResolvedValue({ id: 'inv-1' });
  });

  it('lanza AppError cuando la invitación no existe', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(null);

    await expect(cancelTeamInvitationAction('inv-999', TENANT_SLUG)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lanza AppError cuando la invitación ya fue aceptada', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(makePendingInvitation());
    getTeamInvitationStatusMock.mockReturnValue('ACCEPTED');

    await expect(cancelTeamInvitationAction('inv-1', TENANT_SLUG)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('lanza AppError cuando la invitación ya estaba cancelada', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(makePendingInvitation());
    getTeamInvitationStatusMock.mockReturnValue('CANCELED');

    await expect(cancelTeamInvitationAction('inv-1', TENANT_SLUG)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('cancela la invitación PENDING correctamente', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(makePendingInvitation());

    const result = await cancelTeamInvitationAction('inv-1', TENANT_SLUG);

    expect(result.success).toBe(true);
    expect(result.inviteEmail).toBe('invitado@acme.com');
    expect(dbMock.teamInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ canceledAt: expect.any(Date) }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalled();
  });
});

describe('refreshTeamInvitationLinkAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextByIdMock.mockResolvedValue(makeAdminContext());
    getTeamInvitationStatusMock.mockReturnValue('PENDING');
    createTeamInvitationTokenMock.mockReturnValue({ rawToken: 'new-raw', tokenHash: 'new-hash' });
    getTeamInvitationExpiresAtMock.mockReturnValue(FUTURE_DATE);
    dbMock.teamInvitation.update.mockResolvedValue({ id: 'inv-1' });
  });

  it('lanza AppError cuando la invitación no existe', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(null);

    await expect(refreshTeamInvitationLinkAction('inv-999', TENANT_SLUG)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lanza AppError cuando la invitación ya fue aceptada', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(makePendingInvitation());
    getTeamInvitationStatusMock.mockReturnValue('ACCEPTED');

    await expect(refreshTeamInvitationLinkAction('inv-1', TENANT_SLUG)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('regenera el token de una invitación PENDING y retorna el nuevo path', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(makePendingInvitation());

    const result = await refreshTeamInvitationLinkAction('inv-1', TENANT_SLUG);

    expect(result.invitePath).toBe('/invite/new-raw');
    expect(dbMock.teamInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ tokenHash: 'new-hash' }),
      }),
    );
  });

  it('reserva asiento y regenera token cuando la invitación está EXPIRED', async () => {
    dbMock.teamInvitation.findUnique.mockResolvedValue(makePendingInvitation());
    getTeamInvitationStatusMock.mockReturnValue('EXPIRED');
    dbMock.tenant.findUnique.mockResolvedValue({
      id: TENANT_ID,
      isActive: true,
      deletedAt: null,
      maxUsers: 10,
    });
    dbMock.membership.count.mockResolvedValue(2);
    dbMock.teamInvitation.count.mockResolvedValue(0);

    const result = await refreshTeamInvitationLinkAction('inv-1', TENANT_SLUG);

    expect(result.invitePath).toBe('/invite/new-raw');
  });
});
