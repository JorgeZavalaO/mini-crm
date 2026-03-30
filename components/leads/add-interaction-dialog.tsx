'use client';

import type { InteractionType } from '@prisma/client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageCircle, MessageSquare, Phone, PlusCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createInteractionAction } from '@/lib/interaction-actions';
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

const TYPE_OPTIONS: Array<{ value: InteractionType; label: string; icon: React.ReactNode }> = [
  { value: 'CALL', label: 'Llamada', icon: <Phone className="size-3.5" /> },
  { value: 'EMAIL', label: 'Email', icon: <Mail className="size-3.5" /> },
  { value: 'NOTE', label: 'Nota', icon: <MessageSquare className="size-3.5" /> },
  { value: 'VISIT', label: 'Visita', icon: <Users className="size-3.5" /> },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: <MessageCircle className="size-3.5" /> },
];

const NOTES_MAX = 5000;

function toLocalDatetimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type AddInteractionDialogProps = {
  tenantSlug: string;
  leadId: string;
};

export function AddInteractionDialog({ tenantSlug, leadId }: AddInteractionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const [type, setType] = useState<InteractionType>('CALL');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(toLocalDatetimeValue(new Date()));

  function resetForm() {
    setType('CALL');
    setSubject('');
    setNotes('');
    setOccurredAt(toLocalDatetimeValue(new Date()));
    setSubmitted(false);
  }

  function onSubmit() {
    setSubmitted(true);
    if (!notes.trim()) return;
    startTransition(async () => {
      try {
        await createInteractionAction({
          tenantSlug,
          leadId,
          type,
          subject: subject.trim() || undefined,
          notes,
          occurredAt: new Date(occurredAt),
        });
        toast.success('Interacción registrada');
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No se pudo registrar la interacción';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PlusCircle className="size-4" />
          Registrar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar interacción</DialogTitle>
          <DialogDescription>
            Registra una llamada, email, nota, visita o WhatsApp para este lead.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-ia-type">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
                <SelectTrigger id="add-ia-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex items-center gap-2">
                        {o.icon}
                        {o.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-ia-date">Fecha y hora</Label>
              <Input
                id="add-ia-date"
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-ia-subject">
              Asunto <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="add-ia-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Llamada de seguimiento inicial"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-ia-notes">Notas</Label>
            <Textarea
              id="add-ia-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe brevemente la interacción..."
              rows={4}
              maxLength={NOTES_MAX}
              className="resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              {submitted && !notes.trim() && (
                <p className="text-xs text-destructive">Las notas son obligatorias.</p>
              )}
              <p
                className={cn(
                  'ml-auto text-xs',
                  notes.length > NOTES_MAX * 0.96 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {notes.length}/{NOTES_MAX}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
