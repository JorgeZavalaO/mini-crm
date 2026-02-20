'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import type { LeadStatus, ReassignmentStatus } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  archiveLeadAction,
  assignLeadAction,
  resolveLeadReassignmentAction,
} from '@/lib/lead-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BulkAssignDialog } from './bulk-assign-dialog';
import { LeadFormDialog } from './lead-form-dialog';
import { ReassignRequestDialog } from './reassign-request-dialog';

type LeadOwnerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type LeadRequestHistory = {
  id: string;
  status: ReassignmentStatus;
  reason: string;
  createdAt: string;
  requestedBy: { name: string | null; email: string };
  requestedOwner: { name: string | null; email: string } | null;
};

type LeadRow = {
  id: string;
  businessName: string;
  ruc: string | null;
  status: LeadStatus;
  city: string | null;
  source: string | null;
  country: string | null;
  industry: string | null;
  notes: string | null;
  phones: string[];
  emails: string[];
  ownerId: string | null;
  owner: { id: string; name: string | null; email: string } | null;
  updatedAt: string;
  permissions: { canEdit: boolean };
  reassignmentRequests: LeadRequestHistory[];
};

type PendingReassignment = {
  id: string;
  leadId: string;
  leadBusinessName: string;
  reason: string;
  createdAt: string;
  requestedBy: { name: string | null; email: string };
  requestedOwner: { name: string | null; email: string } | null;
};

interface LeadTableProps {
  tenantSlug: string;
  leads: LeadRow[];
  owners: LeadOwnerOption[];
  totalCount: number;
  assignmentsEnabled: boolean;
  canAssign: boolean;
  canResolveReassignments: boolean;
  pendingReassignments: PendingReassignment[];
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  LOST: 'Perdido',
  WON: 'Ganado',
};

const REQUEST_STATUS_LABEL: Record<ReassignmentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

function getStatusVariant(status: LeadStatus): 'default' | 'outline' | 'destructive' | 'secondary' {
  if (status === 'WON') return 'default';
  if (status === 'LOST') return 'destructive';
  if (status === 'QUALIFIED') return 'secondary';
  return 'outline';
}

function getRequestVariant(
  status: ReassignmentStatus,
): 'default' | 'outline' | 'destructive' | 'secondary' {
  if (status === 'APPROVED') return 'secondary';
  if (status === 'REJECTED') return 'destructive';
  return 'outline';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AssignLeadDialog({
  tenantSlug,
  leadId,
  owners,
  trigger,
}: {
  tenantSlug: string;
  leadId: string;
  owners: LeadOwnerOption[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');

  function onAssign() {
    if (!ownerId) return;
    startTransition(async () => {
      try {
        await assignLeadAction({ tenantSlug, leadId, ownerId });
        toast.success('Lead asignado');
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo asignar el lead';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar lead</DialogTitle>
          <DialogDescription>Selecciona el owner responsable del lead.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un owner" />
            </SelectTrigger>
            <SelectContent>
              {owners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name || owner.email} ({owner.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onAssign} disabled={isPending || !ownerId}>
            {isPending ? 'Asignando...' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveLeadButton({ tenantSlug, leadId }: { tenantSlug: string; leadId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onArchive() {
    startTransition(async () => {
      try {
        await archiveLeadAction({ tenantSlug, leadId });
        toast.success('Lead archivado');
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo archivar el lead';
        toast.error(message);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Archivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archivar lead</AlertDialogTitle>
          <AlertDialogDescription>
            El lead saldra del listado activo. En esta fase no hay restauracion desde UI.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onArchive} disabled={isPending}>
            {isPending ? 'Archivando...' : 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResolveReassignmentButtons({
  tenantSlug,
  requestId,
}: {
  tenantSlug: string;
  requestId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function resolve(status: 'APPROVED' | 'REJECTED') {
    startTransition(async () => {
      try {
        await resolveLeadReassignmentAction({
          tenantSlug,
          requestId,
          status,
        });
        toast.success(`Solicitud ${status === 'APPROVED' ? 'aprobada' : 'rechazada'}`);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo resolver la solicitud';
        toast.error(message);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() => resolve('APPROVED')}
      >
        Aprobar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => resolve('REJECTED')}
      >
        Rechazar
      </Button>
    </div>
  );
}

export function LeadTable({
  tenantSlug,
  leads,
  owners,
  totalCount,
  assignmentsEnabled,
  canAssign,
  canResolveReassignments,
  pendingReassignments,
}: LeadTableProps) {
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const visibleLeadIdSet = useMemo(() => new Set(leads.map((lead) => lead.id)), [leads]);
  const activeSelectedLeadIds = useMemo(
    () => selectedLeadIds.filter((id) => visibleLeadIdSet.has(id)),
    [selectedLeadIds, visibleLeadIdSet],
  );

  const selectedCount = activeSelectedLeadIds.length;
  const allSelected = useMemo(
    () => leads.length > 0 && leads.every((lead) => activeSelectedLeadIds.includes(lead.id)),
    [leads, activeSelectedLeadIds],
  );

  function toggleLead(leadId: string, checked: boolean) {
    setSelectedLeadIds((prev) => {
      if (checked) {
        if (prev.includes(leadId)) return prev;
        return [...prev, leadId];
      }
      return prev.filter((id) => id !== leadId);
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedLeadIds(checked ? leads.map((lead) => lead.id) : []);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {totalCount} lead(s) activo(s)
          {selectedCount > 0 ? ` - ${selectedCount} seleccionado(s)` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canAssign && (
            <BulkAssignDialog
              tenantSlug={tenantSlug}
              owners={owners}
              leadIds={activeSelectedLeadIds}
            />
          )}
          <LeadFormDialog
            tenantSlug={tenantSlug}
            owners={owners}
            canAssign={canAssign}
            trigger={<Button type="button">+ Nuevo lead</Button>}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canAssign && (
                <TableHead className="w-[36px]">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los leads"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </TableHead>
              )}
              <TableHead>Prospecto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Fuente / Ciudad</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead>Solicitudes</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const latestRequest = lead.reassignmentRequests[0];
              return (
                <TableRow key={lead.id}>
                  {canAssign && (
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${lead.businessName}`}
                        checked={activeSelectedLeadIds.includes(lead.id)}
                        onChange={(e) => toggleLead(lead.id, e.target.checked)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="min-w-[250px]">
                    <p className="font-medium">{lead.businessName}</p>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {lead.ruc && <p>RUC: {lead.ruc}</p>}
                      {lead.industry && <p>Rubro: {lead.industry}</p>}
                      {lead.emails.length > 0 && <p>{lead.emails.join(', ')}</p>}
                      {lead.phones.length > 0 && <p>{lead.phones.join(', ')}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(lead.status)}>
                      {STATUS_LABEL[lead.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.owner ? (
                      <div className="text-sm">
                        <p className="font-medium">{lead.owner.name || lead.owner.email}</p>
                        <p className="text-xs text-muted-foreground">{lead.owner.email}</p>
                      </div>
                    ) : (
                      <Badge variant="outline">Sin owner</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <p>{lead.source || '-'}</p>
                    <p>{lead.city || lead.country || '-'}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(lead.updatedAt)}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {latestRequest ? (
                      <div className="space-y-1 text-xs">
                        <Badge variant={getRequestVariant(latestRequest.status)}>
                          {REQUEST_STATUS_LABEL[latestRequest.status]}
                        </Badge>
                        <p className="text-muted-foreground">
                          {latestRequest.requestedBy.name || latestRequest.requestedBy.email}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin solicitudes</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {canAssign && owners.length > 0 && (
                        <AssignLeadDialog
                          tenantSlug={tenantSlug}
                          leadId={lead.id}
                          owners={owners}
                          trigger={
                            <Button type="button" variant="ghost" size="sm">
                              Asignar
                            </Button>
                          }
                        />
                      )}

                      {lead.permissions.canEdit ? (
                        <>
                          <LeadFormDialog
                            tenantSlug={tenantSlug}
                            owners={owners}
                            canAssign={canAssign}
                            lead={lead}
                            trigger={
                              <Button type="button" variant="ghost" size="sm">
                                Editar
                              </Button>
                            }
                          />
                          <ArchiveLeadButton tenantSlug={tenantSlug} leadId={lead.id} />
                        </>
                      ) : (
                        <>
                          <Badge variant="outline">Solo lectura</Badge>
                          {assignmentsEnabled && lead.ownerId && (
                            <ReassignRequestDialog
                              tenantSlug={tenantSlug}
                              leadId={lead.id}
                              owners={owners}
                              trigger={
                                <Button type="button" variant="ghost" size="sm">
                                  Solicitar reasignacion
                                </Button>
                              }
                            />
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {leads.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canAssign ? 8 : 7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay leads para los filtros actuales.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canResolveReassignments && pendingReassignments.length > 0 && (
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="font-semibold">Solicitudes pendientes de reasignacion</h3>
            <p className="text-sm text-muted-foreground">
              Aprueba o rechaza solicitudes de cambio de owner.
            </p>
          </div>
          <div className="space-y-3">
            {pendingReassignments.map((request) => (
              <div
                key={request.id}
                className="flex flex-col justify-between gap-3 rounded-md border p-3 md:flex-row md:items-center"
              >
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{request.leadBusinessName}</p>
                  <p className="text-xs text-muted-foreground">
                    Solicitado por {request.requestedBy.name || request.requestedBy.email} -{' '}
                    {formatDate(request.createdAt)}
                  </p>
                  {request.requestedOwner && (
                    <p className="text-xs text-muted-foreground">
                      Owner sugerido: {request.requestedOwner.name || request.requestedOwner.email}
                    </p>
                  )}
                  <p className="text-xs">{request.reason}</p>
                </div>
                <ResolveReassignmentButtons tenantSlug={tenantSlug} requestId={request.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
