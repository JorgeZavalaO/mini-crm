import { ClipboardList } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { hasRole } from '@/lib/rbac';
import { listTenantTasksAction } from '@/lib/task-actions';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { TaskTabs } from '@/components/tasks/task-tabs';

export default async function TasksPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { session, membership, tenant } = await requireTenantFeature(tenantSlug, 'TASKS');

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
  };

  const [tasksResult, members] = await Promise.all([
    listTenantTasksAction({ tenantSlug, page: 1, pageSize: 200 }).catch(() => ({
      tasks: [],
      total: 0,
    })),
    db.membership.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const { tasks } = tasksResult;

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  const canViewAll = actor.isSuperAdmin || hasRole(actor.role, 'SUPERVISOR');

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
      />
    </div>
  );
}
