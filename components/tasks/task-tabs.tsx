'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import type { TaskRow } from '@/lib/task-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskList } from './task-list';

type MemberOption = { id: string; name: string | null; email: string };

type Props = {
  tasks: TaskRow[];
  tenantSlug: string;
  currentUserId: string;
  currentRole: string | null;
  isSuperAdmin: boolean;
  members: MemberOption[];
  canViewAll: boolean;
};

function StatsCards({ tasks }: { tasks: TaskRow[] }) {
  const stats = {
    pending: tasks.filter((t) => t.status === 'PENDING').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    done: tasks.filter((t) => t.status === 'DONE').length,
    cancelled: tasks.filter((t) => t.status === 'CANCELLED').length,
  };

  return (
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
  );
}

export function TaskTabs({
  tasks,
  tenantSlug,
  currentUserId,
  currentRole,
  isSuperAdmin,
  members,
  canViewAll,
}: Props) {
  const [tab, setTab] = useState<string>('mine');

  const myTasks = useMemo(
    () => tasks.filter((t) => t.createdById === currentUserId || t.assignedToId === currentUserId),
    [tasks, currentUserId],
  );

  if (!canViewAll) {
    // Non-supervisor: no tabs, just show their tasks (already filtered by backend)
    return (
      <>
        <StatsCards tasks={tasks} />
        <Card>
          <CardContent className="px-0 py-2">
            <TaskList
              tasks={tasks}
              tenantSlug={tenantSlug}
              currentUserId={currentUserId}
              currentRole={currentRole}
              isSuperAdmin={isSuperAdmin}
              members={members}
              showLeadName
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="mine">Mis tareas</TabsTrigger>
        <TabsTrigger value="all">Todas</TabsTrigger>
      </TabsList>

      <TabsContent value="mine" className="mt-4 space-y-6">
        <StatsCards tasks={myTasks} />
        <Card>
          <CardContent className="px-0 py-2">
            <TaskList
              tasks={myTasks}
              tenantSlug={tenantSlug}
              currentUserId={currentUserId}
              currentRole={currentRole}
              isSuperAdmin={isSuperAdmin}
              members={members}
              showLeadName
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="all" className="mt-4 space-y-6">
        <StatsCards tasks={tasks} />
        <Card>
          <CardContent className="px-0 py-2">
            <TaskList
              tasks={tasks}
              tenantSlug={tenantSlug}
              currentUserId={currentUserId}
              currentRole={currentRole}
              isSuperAdmin={isSuperAdmin}
              members={members}
              showLeadName
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
