import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const hashPasswordMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/password', () => ({ hashPassword: hashPasswordMock }));

const dbMock = vi.hoisted(() => ({
  membership: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
  teamInvitation: {
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  createMemberAction,
  removeMemberAction,
  toggleMemberAction,
  updateMemberRoleAction,
} from '@/lib/team-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';

function makeSuperAdminSession() {
  return { user: { id: 'sa-1', isSuperAdmin: true } };
}

function makeAdminSession(userId = 'admin-1') {
  return { user: { id: userId, isSuperAdmin: false } };
}

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    tenantId: TENANT_ID,
    userId: 'other-user',
    role: 'VENDEDOR',
    isActive: true,
    user: { id: 'other-user', name: 'Test User' },
    ...overrides,
  };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('createMemberAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.tenant.findUnique.mockResolvedValue({ maxUsers: 10, deletedAt: null });
    dbMock.membership.count.mockResolvedValue(2);
    dbMock.teamInvitation.count.mockResolvedValue(0);
    hashPasswordMock.mockResolvedValue('hashed-pw');
    dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
      fn(dbMock),
    );
    dbMock.user.create.mockResolvedValue({ id: 'new-user-id', name: 'Nuevo Usuario' });
    dbMock.membership.create.mockResolvedValue({ id: 'mem-new' });
  });

  it('retorna error cuando faltan campos requeridos', async () => {
    const fd = makeFormData({ tenantId: TENANT_ID, tenantSlug: TENANT_SLUG });

    const result = await createMemberAction(undefined, fd);

    expect(result).toEqual({ error: 'Todos los campos son requeridos' });
  });

  it('retorna error cuando la contraseña es demasiado corta', async () => {
    const fd = makeFormData({
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      name: 'Carlos',
      email: 'carlos@acme.com',
      password: '123',
      role: 'VENDEDOR',
    });

    const result = await createMemberAction(undefined, fd);

    expect(result).toEqual({ error: 'La contraseña debe tener al menos 8 caracteres' });
  });

  it('retorna error cuando el rol es inválido', async () => {
    const fd = makeFormData({
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      name: 'Carlos',
      email: 'carlos@acme.com',
      password: 'password123',
      role: 'ROL_INVALIDO',
    });

    const result = await createMemberAction(undefined, fd);

    expect(result).toEqual({ error: 'Rol inválido' });
  });

  it('retorna error cuando el usuario ya es miembro del tenant', async () => {
    dbMock.user.findUnique.mockResolvedValue({ id: 'existing-user' });
    dbMock.membership.findUnique.mockResolvedValue({ id: 'existing-mem' });

    const fd = makeFormData({
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      name: 'Carlos',
      email: 'carlos@acme.com',
      password: 'password123',
      role: 'VENDEDOR',
    });

    const result = await createMemberAction(undefined, fd);

    expect(result).toEqual({ error: 'Este usuario ya es miembro de esta empresa' });
  });

  it('crea usuario nuevo y membresía cuando el email no existe', async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    const fd = makeFormData({
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      name: 'Nuevo Usuario',
      email: 'nuevo@acme.com',
      password: 'password123',
      role: 'VENDEDOR',
    });

    await createMemberAction(undefined, fd);

    expect(dbMock.$transaction).toHaveBeenCalled();
    expect(dbMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'nuevo@acme.com' }) }),
    );
  });

  it('retorna error cuando se alcanza el límite de usuarios del tenant', async () => {
    dbMock.user.findUnique.mockResolvedValue(null);
    dbMock.tenant.findUnique.mockResolvedValue({ maxUsers: 3, deletedAt: null });
    dbMock.membership.count.mockResolvedValue(2);
    dbMock.teamInvitation.count.mockResolvedValue(1);

    const fd = makeFormData({
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      name: 'Extra',
      email: 'extra@acme.com',
      password: 'password123',
      role: 'VENDEDOR',
    });

    const result = await createMemberAction(undefined, fd);

    expect(result).toEqual({ error: 'Limite de usuarios alcanzado para este tenant' });
  });
});

describe('updateMemberRoleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.membership.findUnique.mockResolvedValue(makeMembership({ role: 'VENDEDOR' }));
    dbMock.membership.update.mockResolvedValue({ id: 'mem-1', role: 'SUPERVISOR' });
  });

  it('lanza error cuando el rol nuevo es inválido', async () => {
    await expect(updateMemberRoleAction('mem-1', 'ROL_INVALIDO', TENANT_SLUG)).rejects.toThrow(
      'Rol inválido',
    );
  });

  it('lanza error cuando la membresía no existe', async () => {
    dbMock.membership.findUnique.mockResolvedValue(null);

    await expect(updateMemberRoleAction('mem-999', 'SUPERVISOR', TENANT_SLUG)).rejects.toThrow(
      'Membership no encontrada',
    );
  });

  it('actualiza el rol correctamente y redirige', async () => {
    await updateMemberRoleAction('mem-1', 'SUPERVISOR', TENANT_SLUG);

    expect(dbMock.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mem-1' },
        data: { role: 'SUPERVISOR' },
      }),
    );
    expect(redirectMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/team`);
  });
});

describe('toggleMemberAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.tenant.findUnique.mockResolvedValue({ maxUsers: 10, deletedAt: null });
    dbMock.membership.count.mockResolvedValue(2);
    dbMock.teamInvitation.count.mockResolvedValue(0);
    dbMock.membership.update.mockResolvedValue({ id: 'mem-1', isActive: false });
  });

  it('lanza error cuando no hay sesión activa', async () => {
    authMock.mockResolvedValue(null);

    await expect(toggleMemberAction('mem-1', TENANT_SLUG)).rejects.toThrow('No autenticado');
  });

  it('lanza error cuando la membresía no existe', async () => {
    dbMock.membership.findUnique.mockResolvedValue(null);

    await expect(toggleMemberAction('mem-999', TENANT_SLUG)).rejects.toThrow(
      'Membership no encontrada',
    );
  });

  it('desactiva un miembro activo y retorna el nuevo estado', async () => {
    dbMock.membership.findUnique.mockResolvedValue(
      makeMembership({ role: 'VENDEDOR', isActive: true }),
    );
    dbMock.membership.update.mockResolvedValue({ id: 'mem-1', isActive: false });

    const result = await toggleMemberAction('mem-1', TENANT_SLUG);

    expect(result.isActive).toBe(false);
    expect(result.success).toBe(true);
    expect(result.userName).toBe('Test User');
  });

  it('lanza error si se intenta desactivar al único admin del tenant', async () => {
    authMock.mockResolvedValue(makeAdminSession('other-user'));
    dbMock.membership.findUnique.mockResolvedValue(
      makeMembership({ userId: 'sa-1', role: 'ADMIN', isActive: true }),
    );
    // No remaining admins
    dbMock.membership.count.mockResolvedValue(0);

    await expect(toggleMemberAction('mem-1', TENANT_SLUG)).rejects.toThrow(
      'No puedes dejar al tenant sin administradores activos',
    );
  });
});

describe('removeMemberAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(makeSuperAdminSession());
    dbMock.membership.delete.mockResolvedValue({ id: 'mem-1' });
  });

  it('lanza error cuando no hay sesión activa', async () => {
    authMock.mockResolvedValue(null);

    await expect(removeMemberAction('mem-1', TENANT_SLUG)).rejects.toThrow('No autenticado');
  });

  it('lanza error cuando la membresía no existe', async () => {
    dbMock.membership.findUnique.mockResolvedValue(null);

    await expect(removeMemberAction('mem-999', TENANT_SLUG)).rejects.toThrow(
      'Membership no encontrada',
    );
  });

  it('elimina la membresía de un VENDEDOR y retorna éxito', async () => {
    dbMock.membership.findUnique.mockResolvedValue(
      makeMembership({ role: 'VENDEDOR', isActive: true }),
    );

    const result = await removeMemberAction('mem-1', TENANT_SLUG);

    expect(result.success).toBe(true);
    expect(result.userName).toBe('Test User');
    expect(dbMock.membership.delete).toHaveBeenCalledWith({ where: { id: 'mem-1' } });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/team`);
  });

  it('lanza error si se intenta remover al único admin del tenant', async () => {
    authMock.mockResolvedValue(makeAdminSession('other-actor'));
    dbMock.membership.findUnique.mockResolvedValue(
      makeMembership({ userId: 'admin-1', role: 'ADMIN', isActive: true }),
    );
    dbMock.membership.count.mockResolvedValue(0);

    await expect(removeMemberAction('mem-1', TENANT_SLUG)).rejects.toThrow(
      'No puedes dejar al tenant sin administradores activos',
    );
  });
});
