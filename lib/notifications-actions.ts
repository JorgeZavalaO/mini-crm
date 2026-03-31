'use server';

import { db } from '@/lib/db';
import { requireTenantAccess } from '@/lib/auth-guard';
import { hasRole } from '@/lib/rbac';

export type NotificationItem = {
  id: string;
  type:
    | 'UNASSIGNED_LEAD'
    | 'QUOTE_CREATED'
    | 'LEAD_WON'
    | 'LEAD_NEW'
    | 'QUOTE_ACCEPTED'
    | 'QUOTE_REJECTED'
    | 'PENDING_REASSIGNMENT';
  title: string;
  description: string;
  href: string;
  createdAt: Date;
};

export async function getTenantNotificationsAction(
  tenantSlug: string,
): Promise<NotificationItem[]> {
  const { session, tenant, membership } = await requireTenantAccess(tenantSlug);
  const role = membership?.role ?? (session.user.isSuperAdmin ? 'SUPERADMIN' : null);
  const isSuperAdmin = session.user.isSuperAdmin;
  const isSupervisorPlus = isSuperAdmin || hasRole(role, 'SUPERVISOR');

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // últimos 7 días

  const notifications: NotificationItem[] = [];

  // ── 1. Leads sin asignar (cualquier miembro activo lo ve, prioritario) ──
  const unassignedLeads = await db.lead.findMany({
    where: { tenantId: tenant.id, deletedAt: null, ownerId: null },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, businessName: true, ruc: true, createdAt: true },
  });

  for (const lead of unassignedLeads) {
    notifications.push({
      id: `unassigned-${lead.id}`,
      type: 'UNASSIGNED_LEAD',
      title: 'Lead sin asignar',
      description: lead.businessName + (lead.ruc ? ` · ${lead.ruc}` : ''),
      href: `/${tenantSlug}/leads/${lead.id}`,
      createdAt: lead.createdAt,
    });
  }

  // ── 2. Cotizaciones creadas en los últimos 7 días ──
  const recentQuotes = await db.quote.findMany({
    where: { tenantId: tenant.id, deletedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
      lead: { select: { businessName: true } },
    },
  });

  for (const quote of recentQuotes) {
    const total = new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: quote.currency,
      minimumFractionDigits: 2,
    }).format(Number(quote.totalAmount));

    if (quote.status === 'ACEPTADA') {
      notifications.push({
        id: `quote-accepted-${quote.id}`,
        type: 'QUOTE_ACCEPTED',
        title: 'Cotización aceptada',
        description: `${quote.quoteNumber} · ${quote.lead.businessName} · ${total}`,
        href: `/${tenantSlug}/quotes/${quote.id}`,
        createdAt: quote.createdAt,
      });
    } else if (quote.status === 'RECHAZADA') {
      notifications.push({
        id: `quote-rejected-${quote.id}`,
        type: 'QUOTE_REJECTED',
        title: 'Cotización rechazada',
        description: `${quote.quoteNumber} · ${quote.lead.businessName}`,
        href: `/${tenantSlug}/quotes/${quote.id}`,
        createdAt: quote.createdAt,
      });
    } else {
      notifications.push({
        id: `quote-created-${quote.id}`,
        type: 'QUOTE_CREATED',
        title: 'Cotización generada',
        description: `${quote.quoteNumber} por ${quote.createdBy.name ?? quote.createdBy.email} · ${total}`,
        href: `/${tenantSlug}/quotes/${quote.id}`,
        createdAt: quote.createdAt,
      });
    }
  }

  // ── 3. Leads ganados en los últimos 7 días ──
  const wonLeads = await db.lead.findMany({
    where: { tenantId: tenant.id, deletedAt: null, status: 'WON', updatedAt: { gte: since } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      businessName: true,
      updatedAt: true,
      owner: { select: { name: true, email: true } },
    },
  });

  for (const lead of wonLeads) {
    notifications.push({
      id: `won-${lead.id}`,
      type: 'LEAD_WON',
      title: 'Lead ganado 🎉',
      description:
        lead.businessName +
        (lead.owner ? ` · ${lead.owner.name ?? lead.owner.email}` : ' · sin propietario'),
      href: `/${tenantSlug}/leads/${lead.id}`,
      createdAt: lead.updatedAt,
    });
  }

  // ── 4. Nuevos leads en los últimos 7 días ──
  const newLeads = await db.lead.findMany({
    where: { tenantId: tenant.id, deletedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      businessName: true,
      ruc: true,
      createdAt: true,
    },
  });

  for (const lead of newLeads) {
    notifications.push({
      id: `new-lead-${lead.id}`,
      type: 'LEAD_NEW',
      title: 'Nuevo lead registrado',
      description: lead.businessName + (lead.ruc ? ` · ${lead.ruc}` : ''),
      href: `/${tenantSlug}/leads/${lead.id}`,
      createdAt: lead.createdAt,
    });
  }

  // ── 5. Solicitudes de reasignación pendientes (solo SUPERVISOR+) ──
  if (isSupervisorPlus) {
    const pendingReassignments = await db.leadReassignmentRequest.findMany({
      where: { tenantId: tenant.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        lead: { select: { businessName: true } },
        requestedBy: { select: { name: true, email: true } },
      },
    });

    for (const req of pendingReassignments) {
      notifications.push({
        id: `reassign-${req.id}`,
        type: 'PENDING_REASSIGNMENT',
        title: 'Solicitud de reasignación',
        description: `${req.lead.businessName} · ${req.requestedBy.name ?? req.requestedBy.email}`,
        href: `/${tenantSlug}/leads/${req.id}`,
        createdAt: req.createdAt,
      });
    }
  }

  // ── Ordenar por fecha descendente, limitar a 20 ──
  notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return notifications.slice(0, 20);
}
