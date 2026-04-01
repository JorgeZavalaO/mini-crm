'use server';

import { db } from '@/lib/db';
import { requireTenantAccess } from '@/lib/auth-guard';
import { hasRole, type Role } from '@/lib/rbac';
import { AppError } from '@/lib/errors';
import { getPaginationState } from '@/lib/pagination';
import {
  deleteNotificationSchema,
  markNotificationReadSchema,
  notificationFiltersSchema,
} from '@/lib/validators';
import type { NotificationType } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  href: string;
  isRead: boolean;
  createdAt: Date;
};

// ─── Listado de notificaciones (persistidas) ─────────────

export async function listTenantNotificationsPageAction(input: unknown): Promise<{
  items: NotificationItem[];
  total: number;
}> {
  const parsed = notificationFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, isRead, page, pageSize } = parsed.data;
  const { session, tenant } = await requireTenantAccess(tenantSlug);
  const userId = session.user.id;

  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    userId,
    deletedAt: null,
  };

  if (isRead !== undefined) {
    where.isRead = isRead;
  }

  const total = await db.notification.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const items = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      href: true,
      isRead: true,
      createdAt: true,
    },
  });

  return { items, total };
}

export async function getTenantNotificationsAction(
  tenantSlug: string,
  filters?: { isRead?: boolean },
): Promise<NotificationItem[]> {
  const result = await listTenantNotificationsPageAction({
    tenantSlug,
    isRead: filters?.isRead,
    page: 1,
    pageSize: 50,
  });

  return result.items;
}

// ─── Conteo de no leídas ────────────────────────────────

export async function getUnreadCountAction(tenantSlug: string): Promise<number> {
  const { session, tenant } = await requireTenantAccess(tenantSlug);

  return db.notification.count({
    where: {
      tenantId: tenant.id,
      userId: session.user.id,
      isRead: false,
      deletedAt: null,
    },
  });
}

// ─── Marcar como leída ──────────────────────────────────

export async function markNotificationReadAction(input: unknown) {
  const parsed = markNotificationReadSchema.safeParse(input);
  if (!parsed.success) throw new AppError('Datos inválidos', 400);

  const { session, tenant } = await requireTenantAccess(parsed.data.tenantSlug);

  const notification = await db.notification.findFirst({
    where: {
      id: parsed.data.notificationId,
      tenantId: tenant.id,
      userId: session.user.id,
      deletedAt: null,
    },
  });

  if (!notification) throw new AppError('Notificación no encontrada', 404);

  await db.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath(`/${parsed.data.tenantSlug}/notifications`);
  return { success: true };
}

// ─── Marcar todas como leídas ───────────────────────────

export async function markAllNotificationsReadAction(tenantSlug: string) {
  const { session, tenant } = await requireTenantAccess(tenantSlug);

  await db.notification.updateMany({
    where: {
      tenantId: tenant.id,
      userId: session.user.id,
      isRead: false,
      deletedAt: null,
    },
    data: { isRead: true, readAt: new Date() },
  });

  revalidatePath(`/${tenantSlug}/notifications`);
  return { success: true };
}

// ─── Eliminar notificación (soft delete) ────────────────

export async function deleteNotificationAction(input: unknown) {
  const parsed = deleteNotificationSchema.safeParse(input);
  if (!parsed.success) throw new AppError('Datos inválidos', 400);

  const { session, tenant } = await requireTenantAccess(parsed.data.tenantSlug);

  const notification = await db.notification.findFirst({
    where: {
      id: parsed.data.notificationId,
      tenantId: tenant.id,
      userId: session.user.id,
      deletedAt: null,
    },
  });

  if (!notification) throw new AppError('Notificación no encontrada', 404);

  await db.notification.update({
    where: { id: notification.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/${parsed.data.tenantSlug}/notifications`);
  return { success: true };
}

// ─── Crear notificaciones internas (helper) ─────────────

type CreateNotificationParams = {
  tenantId: string;
  tenantSlug: string;
  type: NotificationType;
  title: string;
  description: string;
  href: string;
  recipientUserIds: string[];
};

export async function createNotificationsForEvent(params: CreateNotificationParams) {
  if (params.recipientUserIds.length === 0) return;

  const data = params.recipientUserIds.map((userId) => ({
    tenantId: params.tenantId,
    userId,
    type: params.type,
    title: params.title,
    description: params.description,
    href: params.href,
  }));

  await db.notification.createMany({ data });
}

// ─── Helpers para obtener destinatarios del tenant ──────

export async function getTenantMemberIds(tenantId: string, minRole?: Role): Promise<string[]> {
  const memberships = await db.membership.findMany({
    where: { tenantId, isActive: true },
    select: { userId: true, role: true },
  });

  if (!minRole) return memberships.map((m) => m.userId);

  return memberships.filter((m) => hasRole(m.role, minRole)).map((m) => m.userId);
}
