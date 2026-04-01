'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  Loader2,
  MoreHorizontal,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { hasRole } from '@/lib/rbac';
import { changeTaskStatusAction, deleteTaskAction, type TaskRow } from '@/lib/task-actions';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskFormDialog } from './task-form-dialog';

// ─── Helpers ─────────────────────────────────────────────

function formatDate(value: Date | string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function isOverdue(dueDate: Date | null, status: TaskRow['status']) {
  if (!dueDate || status === 'DONE' || status === 'CANCELLED') return false;
  return new Date(dueDate) < new Date();
}

const STATUS_CONFIG: Record<
  TaskRow['status'],
  { label: string; icon: React.ReactNode; className: string }
> = {
  PENDING: {
    label: 'Pendiente',
    icon: <Circle className="size-4 text-muted-foreground" />,
    className: 'text-muted-foreground',
  },
  IN_PROGRESS: {
    label: 'En progreso',
    icon: <Clock className="size-4 text-blue-500" />,
    className: 'text-blue-600 dark:text-blue-400',
  },
  DONE: {
    label: 'Completada',
    icon: <CheckCircle2 className="size-4 text-emerald-500" />,
    className: 'text-emerald-600 dark:text-emerald-400 line-through',
  },
  CANCELLED: {
    label: 'Cancelada',
    icon: <XCircle className="size-4 text-red-400" />,
    className: 'text-muted-foreground line-through',
  },
};

const PRIORITY_CONFIG: Record<TaskRow['priority'], { label: string; className: string }> = {
  LOW: {
    label: 'Baja',
    className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
  },
  MEDIUM: {
    label: 'Media',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  },
  HIGH: {
    label: 'Alta',
    className:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
  },
  URGENT: {
    label: 'Urgente',
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  },
};

// ─── Single Task Item ─────────────────────────────────────

type MemberOption = { id: string; name: string | null; email: string };

type TaskItemProps = {
  task: TaskRow;
  tenantSlug: string;
  currentUserId: string;
  currentRole: string | null;
  isSuperAdmin: boolean;
  members: MemberOption[];
  showLeadName?: boolean;
};

function TaskItem({
  task,
  tenantSlug,
  currentUserId,
  currentRole,
  isSuperAdmin,
  members,
  showLeadName,
}: TaskItemProps) {
  const [busyStatus, setBusyStatus] = useState(false);
  const [isPending, startTransition] = useTransition();

  const overdue = isOverdue(task.dueDate, task.status);
  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];

  const canModify =
    isSuperAdmin ||
    hasRole(currentRole, 'SUPERVISOR') ||
    task.createdById === currentUserId ||
    task.assignedToId === currentUserId;

  const canDel =
    isSuperAdmin || hasRole(currentRole, 'SUPERVISOR') || task.createdById === currentUserId;

  function handleStatusChange(status: TaskRow['status']) {
    setBusyStatus(true);
    startTransition(async () => {
      try {
        await changeTaskStatusAction({ tenantSlug, taskId: task.id, status });
        toast.success(`Tarea marcada como ${STATUS_CONFIG[status].label}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
      } finally {
        setBusyStatus(false);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteTaskAction({ tenantSlug, taskId: task.id });
        toast.success('Tarea eliminada');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la tarea');
      }
    });
  }

  const loading = (busyStatus || isPending) && !busyStatus;

  return (
    <div
      className={`group flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        task.status === 'DONE' || task.status === 'CANCELLED'
          ? 'bg-muted/30 opacity-70'
          : overdue
            ? 'border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20'
            : 'bg-card hover:bg-muted/30'
      }`}
    >
      {/* Status toggle icon */}
      <button
        type="button"
        onClick={() => handleStatusChange(task.status === 'DONE' ? 'PENDING' : 'DONE')}
        disabled={!canModify || busyStatus}
        className="mt-0.5 shrink-0 disabled:cursor-not-allowed"
        aria-label={task.status === 'DONE' ? 'Marcar pendiente' : 'Marcar completada'}
      >
        {busyStatus ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          statusCfg.icon
        )}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-medium leading-snug ${statusCfg.className}`}>{task.title}</p>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityCfg.className}`}
          >
            {priorityCfg.label}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 dark:text-orange-400">
              <AlertCircle className="size-3" />
              Vencida
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {task.dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
          {task.assignedToName && (
            <span className="flex items-center gap-1">
              <User className="size-3" />
              {task.assignedToName}
            </span>
          )}
          {showLeadName && task.leadName && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {task.leadName}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      {canModify && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {loading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Acciones">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {/* Cambios de estado */}
                {task.status !== 'IN_PROGRESS' &&
                  task.status !== 'DONE' &&
                  task.status !== 'CANCELLED' && (
                    <DropdownMenuItem onClick={() => handleStatusChange('IN_PROGRESS')}>
                      <Clock className="mr-2 size-3.5 text-blue-500" />
                      En progreso
                    </DropdownMenuItem>
                  )}
                {task.status !== 'DONE' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('DONE')}>
                    <CheckCircle2 className="mr-2 size-3.5 text-emerald-500" />
                    Completar
                  </DropdownMenuItem>
                )}
                {task.status !== 'CANCELLED' && task.status !== 'DONE' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('CANCELLED')}>
                    <XCircle className="mr-2 size-3.5 text-red-400" />
                    Cancelar
                  </DropdownMenuItem>
                )}
                {task.status === 'DONE' || task.status === 'CANCELLED' ? (
                  <DropdownMenuItem onClick={() => handleStatusChange('PENDING')}>
                    <Circle className="mr-2 size-3.5" />
                    Reabrir
                  </DropdownMenuItem>
                ) : null}

                <DropdownMenuSeparator />

                <TaskFormDialog
                  tenantSlug={tenantSlug}
                  leadId={task.leadId ?? undefined}
                  members={members}
                  currentUserId={currentUserId}
                  currentRole={currentRole}
                  editTask={task}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Edit2 className="mr-2 size-3.5" />
                      Editar
                    </DropdownMenuItem>
                  }
                />

                {canDel && (
                  <>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Trash2 className="mr-2 size-3.5" />
                          Eliminar
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará <strong>{task.title}</strong>. Esta acción no se puede
                            deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDelete}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Task List ────────────────────────────────────────────

type Props = {
  tasks: TaskRow[];
  tenantSlug: string;
  currentUserId: string;
  currentRole: string | null;
  isSuperAdmin: boolean;
  members: MemberOption[];
  showLeadName?: boolean;
};

export function TaskList({
  tasks,
  tenantSlug,
  currentUserId,
  currentRole,
  isSuperAdmin,
  members,
  showLeadName = false,
}: Props) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <CheckCircle2 className="size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Sin tareas</p>
        <p className="text-xs text-muted-foreground/70">
          Crea la primera tarea con el botón &quot;Nueva tarea&quot;.
        </p>
      </div>
    );
  }

  const active = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const completed = tasks.filter((t) => t.status === 'DONE' || t.status === 'CANCELLED');

  return (
    <div className="space-y-2">
      {active.length > 0 && (
        <div className="space-y-1.5">
          {active.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              tenantSlug={tenantSlug}
              currentUserId={currentUserId}
              currentRole={currentRole}
              isSuperAdmin={isSuperAdmin}
              members={members}
              showLeadName={showLeadName}
            />
          ))}
        </div>
      )}
      {completed.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <span className="transition-transform group-open:rotate-90">▶</span>
            {completed.length} completada{completed.length === 1 ? '' : 's'} / cancelada
            {completed.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {completed.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                tenantSlug={tenantSlug}
                currentUserId={currentUserId}
                currentRole={currentRole}
                isSuperAdmin={isSuperAdmin}
                members={members}
                showLeadName={showLeadName}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
