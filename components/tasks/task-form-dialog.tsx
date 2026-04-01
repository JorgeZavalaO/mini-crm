'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createTaskAction, updateTaskAction, type TaskRow } from '@/lib/task-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { hasRole } from '@/lib/rbac';

type MemberOption = { id: string; name: string | null; email: string };

type Props = {
  tenantSlug: string;
  leadId?: string;
  members: MemberOption[];
  currentUserId?: string;
  currentRole?: string | null;
  editTask?: TaskRow;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
};

const PRIORITY_LABEL = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
} as const;

export function TaskFormDialog({
  tenantSlug,
  leadId,
  members,
  currentUserId,
  currentRole,
  editTask,
  onSuccess,
  trigger,
}: Props) {
  const isEdit = Boolean(editTask);
  const canAssignOthers = hasRole(currentRole, 'SUPERVISOR');
  const visibleMembers = canAssignOthers ? members : members.filter((m) => m.id === currentUserId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(editTask?.title ?? '');
  const [description, setDescription] = useState(editTask?.description ?? '');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>(
    editTask?.priority ?? 'MEDIUM',
  );
  const defaultAssigned =
    editTask?.assignedToId ?? (!canAssignOthers && currentUserId ? currentUserId : '');
  const [assignedToId, setAssignedToId] = useState(defaultAssigned);
  const [dueDate, setDueDate] = useState(
    editTask?.dueDate ? new Date(editTask.dueDate).toISOString().split('T')[0] : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    if (!isEdit) {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setAssignedToId(!canAssignOthers && currentUserId ? currentUserId : '');
      setDueDate('');
    }
    setError(null);
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) resetForm();
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          tenantSlug,
          leadId: leadId ?? undefined,
          title,
          description: description || undefined,
          priority,
          assignedToId: assignedToId || undefined,
          dueDate: dueDate || undefined,
        };

        if (isEdit && editTask) {
          await updateTaskAction({ ...payload, taskId: editTask.id });
          toast.success('Tarea actualizada');
        } else {
          await createTaskAction(payload);
          toast.success('Tarea creada');
        }

        setOpen(false);
        resetForm();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo guardar la tarea';
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1.5 size-3.5" />
            Nueva tarea
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos de la tarea.'
              : 'Crea una tarea de seguimiento para este lead o para el equipo.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="Ej: Llamar al cliente para seguimiento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descripción</Label>
            <Textarea
              id="task-desc"
              placeholder="Detalles adicionales de la tarea…"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as (keyof typeof PRIORITY_LABEL)[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PRIORITY_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Fecha límite</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-assignee">Asignar a</Label>
            <Select
              value={assignedToId || '__NONE__'}
              onValueChange={(v) => setAssignedToId(v === '__NONE__' ? '' : v)}
              disabled={!canAssignOthers && visibleMembers.length <= 1}
            >
              <SelectTrigger id="task-assignee">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                {canAssignOthers && <SelectItem value="__NONE__">Sin asignar</SelectItem>}
                {visibleMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
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
              onClick={handleSubmit}
              disabled={isPending || !title.trim()}
              className="min-w-28"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Guardando…
                </>
              ) : isEdit ? (
                'Guardar cambios'
              ) : (
                'Crear tarea'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
