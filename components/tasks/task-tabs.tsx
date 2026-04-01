'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import { buildSearchHref } from '@/lib/pagination';
import type { TaskRow } from '@/lib/task-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListPagination } from '@/components/ui/list-pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskList } from './task-list';

type MemberOption = { id: string; name: string | null; email: string };

type TaskStats = {
  pending: number;
  inProgress: number;
  done: number;
  cancelled: number;
};

type PaginationMeta = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
};

type TaskQueryState = {
  assignedToId?: string;
  status?: string;
  priority?: string;
  pageSize: number;
};

type Props = {
  tasks: TaskRow[];
  tenantSlug: string;
  currentUserId: string;
  currentRole: string | null;
  isSuperAdmin: boolean;
  members: MemberOption[];
  canViewAll: boolean;
  view: 'mine' | 'all';
  queryState: TaskQueryState;
  pagination: PaginationMeta;
  stats: TaskStats;
};

function StatsCards({ stats }: { stats: TaskStats }) {
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
  view,
  queryState,
  pagination,
  stats,
}: Props) {
  const router = useRouter();

  const pageHref = (page: number) =>
    buildSearchHref(
      {
        view,
        assignedToId: queryState.assignedToId,
        status: queryState.status,
        priority: queryState.priority,
        pageSize: queryState.pageSize,
      },
      { page },
    );

  const viewHref = (nextView: 'mine' | 'all') =>
    buildSearchHref(
      {
        assignedToId: queryState.assignedToId,
        status: queryState.status,
        priority: queryState.priority,
        pageSize: queryState.pageSize,
      },
      { view: nextView, page: 1 },
    );

  if (!canViewAll) {
    return (
      <div className="space-y-6">
        <StatsCards stats={stats} />
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

        <ListPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startItem={pagination.startItem}
          endItem={pagination.endItem}
          hrefForPage={pageHref}
        />
      </div>
    );
  }

  return (
    <Tabs
      value={view}
      onValueChange={(nextView) => router.push(viewHref(nextView as 'mine' | 'all'))}
    >
      <TabsList>
        <TabsTrigger value="mine">Mis tareas</TabsTrigger>
        <TabsTrigger value="all">Todas</TabsTrigger>
      </TabsList>

      <TabsContent value={view} className="mt-4 space-y-6">
        <StatsCards stats={stats} />
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

        <ListPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          startItem={pagination.startItem}
          endItem={pagination.endItem}
          hrefForPage={pageHref}
        />
      </TabsContent>
    </Tabs>
  );
}
