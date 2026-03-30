'use client';

import type { InteractionType } from '@prisma/client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { updateInteractionAction } from '@/lib/interaction-actions';
import type { InteractionItem } from '@/components/leads/interaction-timeline';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const TYPE_OPTIONS: Array<{ value: InteractionType; label: string }> = [
  { value: 'CALL', label: 'Llamada' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'NOTE', label: 'Nota' },
  { value: 'VISIT', label: 'Visita' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

function toLocalDatetimeValue(date: Date) {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type EditInteractionDialogProps = {
  tenantSlug: string;
  interaction: InteractionItem;
};

export function EditInteractionDialog({ tenantSlug, interaction }: EditInteractionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<InteractionType>(interaction.type);
  const [subject, setSubject] = useState(interaction.subject ?? '');
  const [notes, setNotes] = useState(interaction.notes);
  const [occurredAt, setOccurredAt] = useState(
    toLocalDatetimeValue(new Date(interaction.occurredAt)),
  );

  function resetToOriginal() {
    setType(interaction.type);
    setSubject(interaction.subject ?? '');
    setNotes(interaction.notes);
    setOccurredAt(toLocalDatetimeValue(new Date(interaction.occurredAt)));
  }

  function onSubmit() {
    startTransition(async () => {
      try {
        await updateInteractionAction({
          tenantSlug,
          interactionId: interaction.id,
          leadId: interaction.leadId ?? undefined,
          type,
          subject: subject.trim() || undefined,
          notes,
          occurredAt: new Date(occurredAt),
        });
        toast.success('Interacción actualizada');
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No se pudo actualizar la interacción';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetToOriginal();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Editar interacción">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar interacción</DialogTitle>
          <DialogDescription>Actualiza los datos de esta interacción.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-ia-type">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
                <SelectTrigger id="edit-ia-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-ia-date">Fecha y hora</Label>
              <Input
                id="edit-ia-date"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-ia-subject">
              Asunto <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="edit-ia-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Llamada de seguimiento inicial"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-ia-notes">Notas</Label>
            <Textarea
              id="edit-ia-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={5000}
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !notes.trim()}>
            {isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
