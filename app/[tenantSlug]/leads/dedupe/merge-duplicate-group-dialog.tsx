'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { mergeDuplicateLeadsAction } from '@/lib/dedupe-actions';
import { buildMergedLeadData, type DedupableLead } from '@/lib/dedupe-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

type MergeableLead = DedupableLead & {
  statusLabel: string;
  ownerLabel: string;
};

export function MergeDuplicateGroupDialog({
  tenantSlug,
  criterionLabel,
  matchValue,
  leads,
}: {
  tenantSlug: string;
  criterionLabel: string;
  matchValue: string;
  leads: MergeableLead[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [primaryLeadId, setPrimaryLeadId] = useState(leads[0]?.id ?? '');

  const duplicateLeadIds = useMemo(
    () => leads.filter((lead) => lead.id !== primaryLeadId).map((lead) => lead.id),
    [leads, primaryLeadId],
  );

  const primaryLead = useMemo(
    () => leads.find((lead) => lead.id === primaryLeadId) ?? null,
    [leads, primaryLeadId],
  );

  const duplicateLeads = useMemo(
    () => leads.filter((lead) => lead.id !== primaryLeadId),
    [leads, primaryLeadId],
  );

  const mergedPreview = useMemo(() => {
    if (!primaryLead) return null;
    return buildMergedLeadData(primaryLead, duplicateLeads);
  }, [duplicateLeads, primaryLead]);

  const notesCount = useMemo(
    () =>
      [primaryLead?.notes, ...duplicateLeads.map((lead) => lead.notes)].filter(
        (value): value is string => Boolean(value && value.trim().length > 0),
      ).length,
    [duplicateLeads, primaryLead],
  );

  function handleMerge() {
    startTransition(async () => {
      try {
        const result = await mergeDuplicateLeadsAction({
          tenantSlug,
          primaryLeadId,
          duplicateLeadIds,
        });
        toast.success(`${result.mergedCount} lead(s) fusionados en un solo registro`);
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo fusionar el grupo';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          Fusionar grupo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fusionar duplicados</DialogTitle>
          <DialogDescription>
            Coincidencia por {criterionLabel.toLowerCase()}: `{matchValue}`. Elige el lead
            principal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Select value={primaryLeadId} onValueChange={setPrimaryLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el lead principal" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.businessName} · {lead.statusLabel} · {lead.ownerLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">Lead principal</p>
              <p className="mt-2 font-semibold">{primaryLead?.businessName ?? 'Sin selección'}</p>
              <p className="text-xs text-muted-foreground">
                {primaryLead?.statusLabel ?? '—'} · {primaryLead?.ownerLabel ?? 'Sin responsable'}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">Se archivarán</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {duplicateLeads.length > 0 ? (
                  duplicateLeads.map((lead) => (
                    <Badge key={lead.id} variant="secondary">
                      {lead.businessName}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No hay leads para archivar.</span>
                )}
              </div>
            </div>
          </div>

          {mergedPreview && (
            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Resultado estimado</p>
                <p className="text-xs text-muted-foreground">
                  La confirmación consolidará datos de contacto y completará campos vacíos del lead
                  principal.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Emails
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mergedPreview.emails.length > 0 ? (
                      mergedPreview.emails.map((email) => (
                        <Badge key={email} variant="outline">
                          {email}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin correos</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Teléfonos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mergedPreview.phones.length > 0 ? (
                      mergedPreview.phones.map((phone) => (
                        <Badge key={phone} variant="outline">
                          {phone}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin teléfonos</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    RUC
                  </p>
                  <p className="text-sm">{mergedPreview.ruc ?? '—'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ubicación
                  </p>
                  <p className="text-sm">
                    {[mergedPreview.city, mergedPreview.country].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Industria
                  </p>
                  <p className="text-sm">{mergedPreview.industry ?? '—'}</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Fuente
                  </p>
                  <p className="text-sm">{mergedPreview.source ?? '—'}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Se fusionarán {duplicateLeadIds.length} lead(s) duplicados y se combinarán{' '}
                {notesCount} bloque(s) de notas.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleMerge}
            disabled={isPending || !primaryLeadId || duplicateLeadIds.length === 0}
          >
            {isPending ? 'Fusionando...' : 'Confirmar fusión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
