'use server';

import type { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { assertTenantFeatureById, getTenantActionContextBySlug } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { createNotificationsForEvent } from '@/lib/notifications-actions';
import { getPaginationState } from '@/lib/pagination';
import {
  canAssignTaskToOthers,
  canCompleteTask,
  canCreateTask,
  canDeleteTask,
  canEditTask,
  canViewAllTasks,
} from '@/lib/lead-permissions';
import {
  changeTaskStatusSchema,
  createTaskSchema,
  deleteTaskSchema,
  taskFiltersSchema,
  updateTaskSchema,
} from '@/lib/validators';

// ─── Types ──────────────────────────────────────────────

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  leadId: string | null;
  leadName: string | null;
  createdById: string | null;
  createdByName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
};

// ─── Context helpers ─────────────────────────────────────

type TaskActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

function toActorContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
): TaskActorContext {
  return {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

async function getTaskContext(tenantSlug: string): Promise<TaskActorContext> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'TASKS');
  return toActorContext(ctx);
}

function revalidateTaskViews(tenantSlug: string, leadId?: string | null) {
  revalidatePath(`/${tenantSlug}/tasks`);
  if (leadId) revalidatePath(`/${tenantSlug}/leads/${leadId}`);
}

async function assertTaskLeadBelongsToTenant(tenantId: string, leadId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
    select: { id: true },
  });

  if (!lead) {
    throw new AppError('Lead no encontrado', 404);
  }
}

async function assertTaskAssigneeBelongsToTenant(tenantId: string, assignedToId: string) {
  const membership = await db.membership.findUnique({
    where: {
      userId_tenantId: {
        userId: assignedToId,
        tenantId,
      },
    },
    select: { userId: true, isActive: true },
  });

  if (!membership || !membership.isActive) {
    throw new AppError('El usuario asignado no pertenece al tenant o está inactivo', 400);
  }
}

function assertTaskAssignmentChangeAllowed(
  ctx: TaskActorContext,
  previousAssignedToId: string | null,
  nextAssignedToId: string | null,
) {
  if (previousAssignedToId === nextAssignedToId) {
    return;
  }

  const touchesAnotherMember = [previousAssignedToId, nextAssignedToId].some(
    (value) => value != null && value !== ctx.userId,
  );

  if (touchesAnotherMember && !canAssignTaskToOthers(ctx)) {
    throw new AppError('No autorizado para asignar tareas a otros usuarios', 403);
  }
}

async function notifyTaskAssigned(params: {
  ctx: TaskActorContext;
  taskTitle: string;
  leadId?: string | null;
  assignedToId: string | null;
}) {
  const { ctx, taskTitle, leadId, assignedToId } = params;

  if (!assignedToId || assignedToId === ctx.userId) {
    return;
  }

  const href = leadId
    ? `/${ctx.tenantSlug}/leads/${leadId}?tab=tareas`
    : `/${ctx.tenantSlug}/tasks`;

  await createNotificationsForEvent({
    tenantId: ctx.tenantId,
    tenantSlug: ctx.tenantSlug,
    type: 'TASK_ASSIGNED',
    title: 'Nueva tarea asignada',
    description: taskTitle,
    href,
    recipientUserIds: [assignedToId],
  });
}

// ─── Actions ─────────────────────────────────────────────

export async function createTaskAction(input: unknown) {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de tarea inválidos', 400);
  }
  const { tenantSlug, leadId, assignedToId, title, description, priority, dueDate } = parsed.data;

  const ctx = await getTaskContext(tenantSlug);

  if (!canCreateTask(ctx)) {
    throw new AppError('No autorizado para crear tareas', 403);
  }

  if (leadId) {
    await assertTaskLeadBelongsToTenant(ctx.tenantId, leadId);
  }

  assertTaskAssignmentChangeAllowed(ctx, null, assignedToId ?? null);

  if (assignedToId) {
    await assertTaskAssigneeBelongsToTenant(ctx.tenantId, assignedToId);
  }

  const task = await db.task.create({
    data: {
      tenantId: ctx.tenantId,
      leadId: leadId ?? null,
      createdById: ctx.userId,
      assignedToId: assignedToId ?? null,
      title,
      description: description ?? null,
      priority,
      dueDate: dueDate ?? null,
    },
    select: { id: true, leadId: true },
  });

  await notifyTaskAssigned({
    ctx,
    taskTitle: title,
    leadId: task.leadId,
    assignedToId: assignedToId ?? null,
  });

  revalidateTaskViews(tenantSlug, task.leadId);
  return { success: true, taskId: task.id };
}

export async function updateTaskAction(input: unknown) {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de tarea inválidos', 400);
  }
  const { tenantSlug, taskId, leadId, assignedToId, title, description, priority, dueDate } =
    parsed.data;

  const ctx = await getTaskContext(tenantSlug);

  const existing = await db.task.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, leadId: true, createdById: true, assignedToId: true },
  });
  if (!existing) throw new AppError('Tarea no encontrada', 404);

  if (
    !canEditTask(ctx, { createdById: existing.createdById, assignedToId: existing.assignedToId })
  ) {
    throw new AppError('No autorizado para editar esta tarea', 403);
  }

  if (leadId) {
    await assertTaskLeadBelongsToTenant(ctx.tenantId, leadId);
  }

  assertTaskAssignmentChangeAllowed(ctx, existing.assignedToId, assignedToId ?? null);

  if (assignedToId) {
    await assertTaskAssigneeBelongsToTenant(ctx.tenantId, assignedToId);
  }

  await db.task.update({
    where: { id: taskId, tenantId: ctx.tenantId },
    data: {
      leadId: leadId ?? null,
      assignedToId: assignedToId ?? null,
      title,
      description: description ?? null,
      priority,
      dueDate: dueDate ?? null,
    },
  });

  const nextAssignedToId = assignedToId ?? null;
  if (existing.assignedToId !== nextAssignedToId) {
    await notifyTaskAssigned({
      ctx,
      taskTitle: title,
      leadId: leadId ?? existing.leadId,
      assignedToId: nextAssignedToId,
    });
  }

  revalidateTaskViews(tenantSlug, existing.leadId);
  if (leadId && leadId !== existing.leadId) {
    revalidateTaskViews(tenantSlug, leadId);
  }
  return { success: true };
}

export async function changeTaskStatusAction(input: unknown) {
  const parsed = changeTaskStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos de estado inválidos', 400);
  }
  const { tenantSlug, taskId, status } = parsed.data;

  const ctx = await getTaskContext(tenantSlug);

  const existing = await db.task.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, leadId: true, createdById: true, assignedToId: true },
  });
  if (!existing) throw new AppError('Tarea no encontrada', 404);

  if (
    !canCompleteTask(ctx, {
      createdById: existing.createdById,
      assignedToId: existing.assignedToId,
    })
  ) {
    throw new AppError('No autorizado para cambiar el estado de esta tarea', 403);
  }

  await db.task.update({
    where: { id: taskId, tenantId: ctx.tenantId },
    data: {
      status,
      completedAt: status === 'DONE' ? new Date() : null,
    },
  });

  revalidateTaskViews(tenantSlug, existing.leadId);
  return { success: true };
}

export async function deleteTaskAction(input: unknown) {
  const parsed = deleteTaskSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }
  const { tenantSlug, taskId } = parsed.data;

  const ctx = await getTaskContext(tenantSlug);

  const existing = await db.task.findFirst({
    where: { id: taskId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, leadId: true, createdById: true, assignedToId: true },
  });
  if (!existing) throw new AppError('Tarea no encontrada', 404);

  if (
    !canDeleteTask(ctx, {
      createdById: existing.createdById,
      assignedToId: existing.assignedToId,
    })
  ) {
    throw new AppError('No autorizado para eliminar esta tarea', 403);
  }

  await db.task.update({
    where: { id: taskId, tenantId: ctx.tenantId },
    data: { deletedAt: new Date() },
  });

  revalidateTaskViews(tenantSlug, existing.leadId);
  return { success: true };
}

export async function listLeadTasksAction(leadId: string, tenantSlug: string): Promise<TaskRow[]> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'TASKS');

  const actor = toActorContext(ctx);

  const where: Prisma.TaskWhereInput = {
    leadId,
    tenantId: ctx.tenant.id,
    deletedAt: null,
  };

  // Non-supervisors can only see their own tasks
  if (!canViewAllTasks(actor)) {
    where.OR = [{ createdById: actor.userId }, { assignedToId: actor.userId }];
  }

  const tasks = await db.task.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      leadId: true,
      createdById: true,
      assignedToId: true,
      lead: { select: { businessName: true } },
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    leadId: t.leadId,
    leadName: t.lead?.businessName ?? null,
    createdById: t.createdById,
    createdByName: t.createdBy?.name ?? null,
    assignedToId: t.assignedToId,
    assignedToName: t.assignedTo?.name ?? null,
  }));
}

export async function listLeadTasksPageAction(input: unknown): Promise<{
  tasks: TaskRow[];
  total: number;
}> {
  const parsed = taskFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, leadId, status, priority, page, pageSize } = parsed.data;
  if (!leadId) {
    throw new AppError('Lead requerido para listar tareas', 400);
  }

  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'TASKS');

  const actor = toActorContext(ctx);

  const where: Prisma.TaskWhereInput = {
    leadId,
    tenantId: ctx.tenant.id,
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  };

  if (!canViewAllTasks(actor)) {
    where.OR = [{ createdById: actor.userId }, { assignedToId: actor.userId }];
  }

  const total = await db.task.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const tasks = await db.task.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      leadId: true,
      createdById: true,
      assignedToId: true,
      lead: { select: { businessName: true } },
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      leadId: t.leadId,
      leadName: t.lead?.businessName ?? null,
      createdById: t.createdById,
      createdByName: t.createdBy?.name ?? null,
      assignedToId: t.assignedToId,
      assignedToName: t.assignedTo?.name ?? null,
    })),
    total,
  };
}

export async function listTenantTasksAction(input: unknown): Promise<{
  tasks: TaskRow[];
  total: number;
}> {
  const parsed = taskFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }
  const { tenantSlug, leadId, assignedToId, status, priority, scope, page, pageSize } = parsed.data;

  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'TASKS');

  const actor = toActorContext(ctx);

  const where: Prisma.TaskWhereInput = {
    tenantId: ctx.tenant.id,
    deletedAt: null,
    ...(leadId ? { leadId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  };

  // Scope "mine" fuerza vista personal incluso para managers.
  if (scope === 'mine') {
    where.OR = [{ createdById: actor.userId }, { assignedToId: actor.userId }];
  } else if (!canViewAllTasks(actor)) {
    // Non-supervisors can only see tasks they created or are assigned to
    where.OR = [{ createdById: actor.userId }, { assignedToId: actor.userId }];
  }

  const total = await db.task.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const tasks = await db.task.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      leadId: true,
      createdById: true,
      assignedToId: true,
      lead: { select: { businessName: true } },
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      leadId: t.leadId,
      leadName: t.lead?.businessName ?? null,
      createdById: t.createdById,
      createdByName: t.createdBy?.name ?? null,
      assignedToId: t.assignedToId,
      assignedToName: t.assignedTo?.name ?? null,
    })),
    total,
  };
}
