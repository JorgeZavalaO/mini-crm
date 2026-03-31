import { CheckCircle2, Circle, ClipboardList, Clock, XCircle } from 'lucide-react';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { listTenantTasksAction } from '@/lib/task-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { TaskList } from '@/components/tasks/task-list';

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

  const stats = {
    pending: tasks.filter((t) => t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    done: tasks.filter((t) => t.status === 'DONE').length,
    cancelled: tasks.filter((t) => t.status === 'CANCELLED').length,
  };

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
        <TaskFormDialog tenantSlug={tenantSlug} members={memberOptions} />
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pendientes
            </CardTitle>
            <Circle className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              En progreso
            </CardTitle>
            <Clock className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold">{stats.inProgress}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Completadas
            </CardTitle>
            <CheckCircle2 className="size-4 text-green-500" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold">{stats.done}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-muted-foreground/30">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Canceladas
            </CardTitle>
            <XCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de tareas */}
      <Card>
        <CardContent className="px-0 py-2">
          <TaskList
            tasks={tasks}
            tenantSlug={tenantSlug}
            currentUserId={actor.userId}
            currentRole={actor.role}
            isSuperAdmin={actor.isSuperAdmin}
            members={memberOptions}
            showLeadName
          />
        </CardContent>
      </Card>
    </div>
  );
}
