import type { LeadStatus, ReassignmentStatus } from '@prisma/client';

export type StatusBadgeVariant = 'default' | 'outline' | 'destructive' | 'secondary';

export const LEAD_STATUS_ORDER: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  LOST: 'Perdido',
  WON: 'Ganado',
};

export const REASSIGNMENT_STATUS_LABEL: Record<ReassignmentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

export function getLeadStatusVariant(status: LeadStatus): StatusBadgeVariant {
  if (status === 'WON') return 'default';
  if (status === 'LOST') return 'destructive';
  if (status === 'QUALIFIED') return 'secondary';
  return 'outline';
}

export function getReassignmentStatusVariant(status: ReassignmentStatus): StatusBadgeVariant {
  if (status === 'APPROVED') return 'secondary';
  if (status === 'REJECTED') return 'destructive';
  return 'outline';
}

export type LeadStatusCountRow = {
  status: LeadStatus;
  _count: { _all: number };
};

export function buildLeadStatusBuckets(rows: LeadStatusCountRow[]) {
  const countByStatus = rows.reduce(
    (acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    },
    {} as Partial<Record<LeadStatus, number>>,
  );

  return LEAD_STATUS_ORDER.map((status) => ({
    status,
    label: LEAD_STATUS_LABEL[status],
    count: countByStatus[status] ?? 0,
    variant: getLeadStatusVariant(status),
  }));
}
