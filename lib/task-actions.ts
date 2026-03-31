'use server';

import type { TaskPriority, TaskStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { assertTenantFeatureById, getTenantActionContextBySlug } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { canCompleteTask, canCreateTask, canDeleteTask, canEditTask } from '@/lib/lead-permissions';
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
  createdById: string;
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

  // Verificar que el lead pertenece al tenant
  if (leadId) {
    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new AppError('Lead no encontrado', 404);
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

  await db.task.update({
    where: { id: taskId },
    data: {
      leadId: leadId ?? null,
      assignedToId: assignedToId ?? null,
      title,
      description: description ?? null,
      priority,
      dueDate: dueDate ?? null,
    },
  });

  revalidateTaskViews(tenantSlug, existing.leadId);
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
    where: { id: taskId },
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
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });

  revalidateTaskViews(tenantSlug, existing.leadId);
  return { success: true };
}

export async function listLeadTasksAction(leadId: string, tenantSlug: string): Promise<TaskRow[]> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'TASKS');

  const tasks = await db.task.findMany({
    where: { leadId, tenantId: ctx.tenant.id, deletedAt: null },
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

export async function listTenantTasksAction(input: unknown): Promise<{
  tasks: TaskRow[];
  total: number;
}> {
  const parsed = taskFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }
  const { tenantSlug, leadId, assignedToId, status, priority, page, pageSize } = parsed.data;

  const ctx = await getTenantActionContextBySlug(tenantSlug);
  await assertTenantFeatureById(ctx.tenant.id, 'TASKS');

  const where = {
    tenantId: ctx.tenant.id,
    deletedAt: null,
    ...(leadId ? { leadId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  };

  const [tasks, total] = await Promise.all([
    db.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
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
    }),
    db.task.count({ where }),
  ]);

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
