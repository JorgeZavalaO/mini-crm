import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { requireTenantAccessMock } = vi.hoisted(() => ({
  requireTenantAccessMock: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({
  requireTenantAccess: requireTenantAccessMock,
}));

const dbMock = vi.hoisted(() => ({
  notification: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  membership: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  getTenantNotificationsAction,
  getUnreadCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationAction,
  createNotificationsForEvent,
  getTenantMemberIds,
} from '@/lib/notifications-actions';

const TENANT_ID = 'tenant-t1';
const TENANT_SLUG = 'acme';
const USER_ID = 'user-a';
const NOTIF_ID = 'notif-1';

function makeTenantAccess(userId = USER_ID) {
  return {
    session: { user: { id: userId, isSuperAdmin: false } },
    tenant: { id: TENANT_ID },
    membership: { role: 'ADMIN' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireTenantAccessMock.mockResolvedValue(makeTenantAccess());
});

// ─── getTenantNotificationsAction ─────────────────────

describe('getTenantNotificationsAction', () => {
  it('devuelve notificaciones del usuario', async () => {
    const rows = [
      {
        id: NOTIF_ID,
        type: 'LEAD_NEW',
        title: 'Nuevo lead',
        description: 'desc',
        href: '/x',
        isRead: false,
        createdAt: new Date(),
      },
    ];
    dbMock.notification.findMany.mockResolvedValue(rows);

    const result = await getTenantNotificationsAction(TENANT_SLUG);
    expect(result).toEqual(rows);
    expect(dbMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, userId: USER_ID, deletedAt: null },
        take: 50,
      }),
    );
  });

  it('filtra por isRead cuando se pasa', async () => {
    dbMock.notification.findMany.mockResolvedValue([]);

    await getTenantNotificationsAction(TENANT_SLUG, { isRead: false });
    expect(dbMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, userId: USER_ID, deletedAt: null, isRead: false },
      }),
    );
  });
});

// ─── getUnreadCountAction ─────────────────────────────

describe('getUnreadCountAction', () => {
  it('devuelve conteo de no leídas', async () => {
    dbMock.notification.count.mockResolvedValue(5);

    const result = await getUnreadCountAction(TENANT_SLUG);
    expect(result).toBe(5);
    expect(dbMock.notification.count).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, userId: USER_ID, isRead: false, deletedAt: null },
    });
  });
});

// ─── markNotificationReadAction ───────────────────────

describe('markNotificationReadAction', () => {
  it('marca notificación como leída', async () => {
    dbMock.notification.findFirst.mockResolvedValue({ id: NOTIF_ID });
    dbMock.notification.update.mockResolvedValue({});

    const result = await markNotificationReadAction({
      tenantSlug: TENANT_SLUG,
      notificationId: NOTIF_ID,
    });

    expect(result).toEqual({ success: true });
    expect(dbMock.notification.update).toHaveBeenCalledWith({
      where: { id: NOTIF_ID },
      data: { isRead: true, readAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/notifications`);
  });

  it('lanza 404 si no existe', async () => {
    dbMock.notification.findFirst.mockResolvedValue(null);
    await expect(
      markNotificationReadAction({ tenantSlug: TENANT_SLUG, notificationId: 'nope' }),
    ).rejects.toThrow('Notificación no encontrada');
  });

  it('lanza 400 con datos inválidos', async () => {
    await expect(markNotificationReadAction({})).rejects.toThrow('Datos inválidos');
  });
});

// ─── markAllNotificationsReadAction ───────────────────

describe('markAllNotificationsReadAction', () => {
  it('marca todas como leídas', async () => {
    dbMock.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await markAllNotificationsReadAction(TENANT_SLUG);
    expect(result).toEqual({ success: true });
    expect(dbMock.notification.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        userId: USER_ID,
        isRead: false,
        deletedAt: null,
      },
      data: { isRead: true, readAt: expect.any(Date) },
    });
  });
});

// ─── deleteNotificationAction ─────────────────────────

describe('deleteNotificationAction', () => {
  it('soft-delete de notificación', async () => {
    dbMock.notification.findFirst.mockResolvedValue({ id: NOTIF_ID });
    dbMock.notification.update.mockResolvedValue({});

    const result = await deleteNotificationAction({
      tenantSlug: TENANT_SLUG,
      notificationId: NOTIF_ID,
    });

    expect(result).toEqual({ success: true });
    expect(dbMock.notification.update).toHaveBeenCalledWith({
      where: { id: NOTIF_ID },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('lanza 404 si no existe', async () => {
    dbMock.notification.findFirst.mockResolvedValue(null);
    await expect(
      deleteNotificationAction({ tenantSlug: TENANT_SLUG, notificationId: 'nope' }),
    ).rejects.toThrow('Notificación no encontrada');
  });
});

// ─── createNotificationsForEvent ──────────────────────

describe('createNotificationsForEvent', () => {
  it('crea notificaciones para todos los destinatarios', async () => {
    dbMock.notification.createMany.mockResolvedValue({ count: 2 });

    await createNotificationsForEvent({
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      type: 'LEAD_NEW',
      title: 'Nuevo lead',
      description: 'Juan Pérez',
      href: '/acme/leads/1',
      recipientUserIds: ['user-a', 'user-b'],
    });

    expect(dbMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: TENANT_ID,
          userId: 'user-a',
          type: 'LEAD_NEW',
          title: 'Nuevo lead',
          description: 'Juan Pérez',
          href: '/acme/leads/1',
        },
        {
          tenantId: TENANT_ID,
          userId: 'user-b',
          type: 'LEAD_NEW',
          title: 'Nuevo lead',
          description: 'Juan Pérez',
          href: '/acme/leads/1',
        },
      ],
    });
  });

  it('no hace nada cuando no hay destinatarios', async () => {
    await createNotificationsForEvent({
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      type: 'LEAD_NEW',
      title: 't',
      description: 'd',
      href: '/x',
      recipientUserIds: [],
    });

    expect(dbMock.notification.createMany).not.toHaveBeenCalled();
  });
});

// ─── getTenantMemberIds ───────────────────────────────

describe('getTenantMemberIds', () => {
  it('devuelve todos los user ids sin filtro', async () => {
    dbMock.membership.findMany.mockResolvedValue([
      { userId: 'u1', role: 'ADMIN' },
      { userId: 'u2', role: 'MEMBER' },
    ]);

    const ids = await getTenantMemberIds(TENANT_ID);
    expect(ids).toEqual(['u1', 'u2']);
  });

  it('filtra por rol mínimo', async () => {
    dbMock.membership.findMany.mockResolvedValue([
      { userId: 'u1', role: 'ADMIN' },
      { userId: 'u2', role: 'MEMBER' },
    ]);

    const ids = await getTenantMemberIds(TENANT_ID, 'ADMIN');
    expect(ids).toEqual(['u1']);
  });
});
