import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireTenantFeature } from '@/lib/auth-guard';
import { buildDuplicateGroupsByCriterion, DUPLICATE_CRITERION_LABEL } from '@/lib/dedupe-utils';
import { db } from '@/lib/db';
import { canManageDuplicateLeads } from '@/lib/lead-permissions';
import { getLeadStatusVariant, LEAD_STATUS_LABEL } from '@/lib/lead-status';
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
import { MergeDuplicateGroupDialog } from './merge-duplicate-group-dialog';

export default async function LeadDedupePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant, membership, session } = await requireTenantFeature(tenantSlug, 'DEDUPE');

  const actor = {
    userId: session.user.id,
    role: membership?.role ?? null,
    isSuperAdmin: session.user.isSuperAdmin,
    isActiveMember: session.user.isSuperAdmin || Boolean(membership?.isActive),
  };

  if (!canManageDuplicateLeads(actor)) {
    notFound();
  }

  const leads = await db.lead.findMany({
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
      owner: { select: { name: true, email: true } },
    },
  });

  const groupsByCriterion = buildDuplicateGroupsByCriterion(leads);
  const totalGroups = Object.values(groupsByCriterion).reduce(
    (acc, groups) => acc + groups.length,
    0,
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Duplicados</h1>
          <p className="text-muted-foreground">
            Revisa coincidencias determinísticas por RUC, email, teléfono y nombre normalizado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/${tenantSlug}/leads`}>Volver a leads</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${tenantSlug}/leads/import`}>Ir a importación</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(groupsByCriterion).map(([criterion, groups]) => (
          <Card key={criterion}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {DUPLICATE_CRITERION_LABEL[criterion as keyof typeof groupsByCriterion]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{groups.length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalGroups === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin coincidencias</CardTitle>
            <CardDescription>
              No se detectaron grupos duplicados en este momento. Buena señal, o muy buena limpieza.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupsByCriterion).map(([criterion, groups]) => {
            if (groups.length === 0) return null;

            return (
              <section key={criterion} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {DUPLICATE_CRITERION_LABEL[criterion as keyof typeof groupsByCriterion]}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {groups.length} grupo(s) detectado(s) por esta señal.
                  </p>
                </div>

                <div className="space-y-4">
                  {groups.map((group) => (
                    <Card key={group.id}>
                      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <CardTitle>{group.matchValue}</CardTitle>
                          <CardDescription>
                            {group.leads.length} leads en este grupo
                          </CardDescription>
                        </div>
                        <MergeDuplicateGroupDialog
                          tenantSlug={tenantSlug}
                          criterionLabel={DUPLICATE_CRITERION_LABEL[group.criterion]}
                          matchValue={group.matchValue}
                          leads={group.leads.map((lead) => ({
                            id: lead.id,
                            businessName: lead.businessName,
                            ruc: lead.ruc,
                            rucNormalized: lead.rucNormalized,
                            nameNormalized: lead.nameNormalized,
                            country: lead.country,
                            city: lead.city,
                            industry: lead.industry,
                            source: lead.source,
                            notes: lead.notes,
                            phones: lead.phones,
                            emails: lead.emails,
                            status: lead.status,
                            ownerId: lead.ownerId,
                            owner: lead.owner,
                            statusLabel: LEAD_STATUS_LABEL[lead.status],
                            ownerLabel: lead.owner?.name || lead.owner?.email || 'Sin owner',
                          }))}
                        />
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Lead</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Owner</TableHead>
                              <TableHead>Ubicación</TableHead>
                              <TableHead>Contacto</TableHead>
                              <TableHead className="text-right">Detalle</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.leads.map((lead) => (
                              <TableRow key={lead.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{lead.businessName}</p>
                                    {lead.ruc && (
                                      <p className="text-xs text-muted-foreground">
                                        RUC: {lead.ruc}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={getLeadStatusVariant(lead.status)}>
                                    {LEAD_STATUS_LABEL[lead.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {lead.owner?.name || lead.owner?.email || 'Sin owner'}
                                </TableCell>
                                <TableCell>
                                  {[lead.city, lead.country].filter(Boolean).join(', ') || '—'}
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs text-muted-foreground">
                                    {lead.emails[0] && <p>{lead.emails[0]}</p>}
                                    {lead.phones[0] && <p>{lead.phones[0]}</p>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/${tenantSlug}/leads/${lead.id}`}>Ver lead</Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
