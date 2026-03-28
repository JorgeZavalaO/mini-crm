import Link from 'next/link';
import { requireTenantFeature } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { buildDuplicateGroupsByCriterion, summarizeDuplicateGroups } from '@/lib/dedupe-utils';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { buildLeadStatusBuckets, LEAD_STATUS_LABEL } from '@/lib/lead-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatDate(value: Date) {
  return value.toLocaleString('es-PE', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant, membership, session } = await requireTenantFeature(tenantSlug, 'DASHBOARD');
  const [assignmentsEnabled, importEnabled, dedupeEnabled] = await Promise.all([
    isTenantFeatureEnabled(tenant.id, 'ASSIGNMENTS'),
    isTenantFeatureEnabled(tenant.id, 'IMPORT'),
    isTenantFeatureEnabled(tenant.id, 'DEDUPE'),
  ]);

  const [
    leads,
    members,
    unassignedLeads,
    pendingReassignments,
    statusRows,
    recentLeads,
    myLeads,
    dedupeLeads,
  ] = await Promise.all([
    db.lead.count({ where: { tenantId: tenant.id, deletedAt: null } }),
    db.membership.count({ where: { tenantId: tenant.id, isActive: true } }),
    db.lead.count({ where: { tenantId: tenant.id, deletedAt: null, ownerId: null } }),
    assignmentsEnabled
      ? db.leadReassignmentRequest.count({
          where: { tenantId: tenant.id, status: 'PENDING' },
        })
      : Promise.resolve(0),
    db.lead.groupBy({
      by: ['status'],
      where: { tenantId: tenant.id, deletedAt: null },
      _count: { _all: true },
    }),
    db.lead.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        businessName: true,
        status: true,
        city: true,
        updatedAt: true,
        owner: { select: { name: true, email: true } },
      },
    }),
    session.user.isSuperAdmin
      ? Promise.resolve(0)
      : db.lead.count({
          where: { tenantId: tenant.id, deletedAt: null, ownerId: session.user.id },
        }),
    dedupeEnabled
      ? db.lead.findMany({
          where: { tenantId: tenant.id, deletedAt: null },
          orderBy: { updatedAt: 'asc' },
          select: {
            id: true,
            businessName: true,
            ruc: true,
            rucNormalized: true,
            nameNormalized: true,
            country: true,
            city: true,
            industry: true,
            source: true,
            notes: true,
            phones: true,
            emails: true,
            status: true,
            ownerId: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const displayRole = membership?.role ?? (session.user.isSuperAdmin ? 'SUPERADMIN' : '—');
  const statusBuckets = buildLeadStatusBuckets(statusRows);
  const duplicateSummary = dedupeEnabled
    ? summarizeDuplicateGroups(buildDuplicateGroupsByCriterion(dedupeLeads))
    : {
        totalGroups: 0,
        totalLeadsAtRisk: 0,
        byCriterion: { RUC: 0, EMAIL: 0, PHONE: 0, NAME: 0 },
      };

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visión rápida del pipeline, ownership y actividad comercial reciente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${tenantSlug}/leads`}>Ir a leads</Link>
          </Button>
          {importEnabled && (
            <Button variant="outline" asChild>
              <Link href={`/${tenantSlug}/leads/import`}>Importar</Link>
            </Button>
          )}
          {dedupeEnabled && (
            <Button variant="outline" asChild>
              <Link href={`/${tenantSlug}/leads/dedupe`}>Duplicados</Link>
            </Button>
          )}
          <Button asChild>
            <Link href={`/${tenantSlug}/leads?page=1&status=NEW`}>Revisar nuevos</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leads}</p>
            <p className="text-sm text-muted-foreground">Pipeline activo del tenant</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads sin owner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{unassignedLeads}</p>
            <p className="text-sm text-muted-foreground">Cola pendiente de asignación</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solicitudes pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingReassignments}</p>
            <p className="text-sm text-muted-foreground">
              {assignmentsEnabled
                ? 'Reasignaciones esperando resolución'
                : 'Asignaciones deshabilitadas'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Miembros activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{members}</p>
            <p className="text-sm text-muted-foreground">Equipo actualmente operativo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duplicados detectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{duplicateSummary.totalGroups}</p>
            <p className="text-sm text-muted-foreground">
              {dedupeEnabled
                ? `${duplicateSummary.totalLeadsAtRisk} lead(s) potencialmente afectados`
                : 'Deduplicación deshabilitada'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {session.user.isSuperAdmin ? 'Modo actual' : 'Mi cartera'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {session.user.isSuperAdmin ? displayRole : myLeads}
            </p>
            <p className="text-sm text-muted-foreground">
              {session.user.isSuperAdmin
                ? 'Acceso con privilegios de plataforma'
                : 'Leads con ownership directo'}
            </p>
          </CardContent>
        </Card>
      </div>

      {(importEnabled || dedupeEnabled) && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Herramientas del Sprint 4</h2>
            <p className="text-sm text-muted-foreground">
              Accesos directos para carga masiva y limpieza operativa del pipeline.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {importEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle>Importación masiva</CardTitle>
                  <CardDescription>
                    Carga leads por CSV pegado en texto, con validación y descarte de colisiones.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Útil para onboardings rápidos, migraciones iniciales y demos comerciales.
                  </p>
                  <Button asChild>
                    <Link href={`/${tenantSlug}/leads/import`}>Abrir importación</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {dedupeEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle>Revisión de duplicados</CardTitle>
                  <CardDescription>
                    Detección determinística por RUC, email, teléfono y nombre normalizado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">RUC: {duplicateSummary.byCriterion.RUC}</Badge>
                    <Badge variant="outline">Email: {duplicateSummary.byCriterion.EMAIL}</Badge>
                    <Badge variant="outline">Teléfono: {duplicateSummary.byCriterion.PHONE}</Badge>
                    <Badge variant="outline">Nombre: {duplicateSummary.byCriterion.NAME}</Badge>
                  </div>
                  <Button asChild>
                    <Link href={`/${tenantSlug}/leads/dedupe`}>Abrir deduplicación</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Pipeline por estado</h2>
          <p className="text-sm text-muted-foreground">
            Distribución actual del embudo comercial con acceso rápido al listado filtrado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statusBuckets.map((bucket) => {
            const percentage = leads === 0 ? 0 : Math.round((bucket.count / leads) * 100);

            return (
              <Card key={bucket.status}>
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {bucket.label}
                    </CardTitle>
                    <Badge variant={bucket.variant}>{bucket.count}</Badge>
                  </div>
                  <CardDescription>{percentage}% del total activo</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="px-0" asChild>
                    <Link href={`/${tenantSlug}/leads?status=${bucket.status}&page=1`}>
                      Abrir listado filtrado
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
          <CardDescription>
            Últimos leads actualizados para entrar directo al detalle o continuar seguimiento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay leads activos para este tenant.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.businessName}</TableCell>
                    <TableCell>{LEAD_STATUS_LABEL[lead.status]}</TableCell>
                    <TableCell>{lead.owner?.name || lead.owner?.email || 'Sin owner'}</TableCell>
                    <TableCell>{lead.city || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(lead.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/${tenantSlug}/leads/${lead.id}`}>Ver detalle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
