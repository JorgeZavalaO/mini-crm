import type { Prisma } from '@prisma/client';
import { ClipboardList } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { firstSearchParam, getPaginationState } from '@/lib/pagination';
import { hasRole } from '@/lib/rbac';
import { listTenantTasksAction } from '@/lib/task-actions';
import { taskFiltersSchema } from '@/lib/validators';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { TaskTabs } from '@/components/tasks/task-tabs';

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const [{ session, membership, tenant }, rawSearchParams] = await Promise.all([
    requireTenantFeature(tenantSlug, 'TASKS'),
    searchParams,
  ]);

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
  };

  const parsedFilters = taskFiltersSchema.safeParse({
    tenantSlug,
    assignedToId: firstSearchParam(rawSearchParams.assignedToId),
    status: firstSearchParam(rawSearchParams.status),
    priority: firstSearchParam(rawSearchParams.priority),
    scope: firstSearchParam(rawSearchParams.view) === 'mine' ? 'mine' : 'all',
    page: firstSearchParam(rawSearchParams.page) ?? '1',
    pageSize: firstSearchParam(rawSearchParams.pageSize) ?? '20',
  });

  const filters = parsedFilters.success
    ? parsedFilters.data
    : taskFiltersSchema.parse({ tenantSlug, scope: 'all', page: 1, pageSize: 20 });

  const canViewAll = actor.isSuperAdmin || hasRole(actor.role, 'SUPERVISOR');
  const activeView = canViewAll && filters.scope === 'mine' ? 'mine' : 'all';

  const statsWhere: Prisma.TaskWhereInput = {
    tenantId: tenant.id,
    deletedAt: null,
    ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
  };

  if (activeView === 'mine' || !canViewAll) {
    statsWhere.OR = [{ createdById: actor.userId }, { assignedToId: actor.userId }];
  }

  const [tasksResult, members, statusRows] = await Promise.all([
    listTenantTasksAction({ ...filters, scope: activeView }).catch((err) => {
      console.error('[tasks] Error loading tasks:', err);
      return { tasks: [] as Awaited<ReturnType<typeof listTenantTasksAction>>['tasks'], total: 0 };
    }),
    db.membership.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.task.groupBy({
      by: ['status'],
      where: statsWhere,
      _count: { _all: true },
    }),
  ]);

  const { tasks, total } = tasksResult;

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  const countByStatus = statusRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const pagination = getPaginationState({
    totalItems: total,
    page: filters.page,
    pageSize: filters.pageSize,
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardList className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona las acciones pendientes de tu equipo.
            </p>
          </div>
        </div>
        <TaskFormDialog
          tenantSlug={tenantSlug}
          members={memberOptions}
          currentUserId={actor.userId}
          currentRole={actor.role}
        />
      </div>

      {/* Tabs + Stats + Lista */}
      <TaskTabs
        tasks={tasks}
        tenantSlug={tenantSlug}
        currentUserId={actor.userId}
        currentRole={actor.role}
        isSuperAdmin={actor.isSuperAdmin}
        members={memberOptions}
        canViewAll={canViewAll}
        view={activeView}
        queryState={{
          assignedToId: filters.assignedToId,
          status: filters.status,
          priority: filters.priority,
          pageSize: filters.pageSize,
        }}
        pagination={{
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          totalItems: total,
          startItem: pagination.startItem,
          endItem: pagination.endItem,
        }}
        stats={{
          pending: countByStatus.PENDING ?? 0,
          inProgress: countByStatus.IN_PROGRESS ?? 0,
          done: countByStatus.DONE ?? 0,
          cancelled: countByStatus.CANCELLED ?? 0,
        }}
      />
    </div>
  );
}
