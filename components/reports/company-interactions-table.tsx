import Link from 'next/link';
import type { InteractionType } from '@prisma/client';
import {
  Building2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Users as VisitIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListPagination } from '@/components/ui/list-pagination';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER, getLeadStatusVariant } from '@/lib/lead-status';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/date-utils';
import type { CompanyContactRow } from '@/lib/reporting/company-interactions-types';
import { INTERACTION_LABEL } from '@/lib/reporting/company-interactions-types';
import { buildSearchHref } from '@/lib/pagination';
import { cn } from '@/lib/utils';

const TYPE_ICON_CLASS: Record<InteractionType, string> = {
  CALL: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  EMAIL: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  NOTE: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  VISIT: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  WHATSAPP: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
};

const TYPE_ICON: Record<InteractionType, React.ReactNode> = {
  CALL: <Phone className="size-3.5" />,
  EMAIL: <Mail className="size-3.5" />,
  NOTE: <MessageSquare className="size-3.5" />,
  VISIT: <VisitIcon className="size-3.5" />,
  WHATSAPP: <MessageCircle className="size-3.5" />,
};

type QueryState = {
  preset: string;
  scope: 'mine' | 'all';
  type?: string;
  authorId?: string;
  leadStatus?: string;
  leadOwnerId?: string;
  city?: string;
  country?: string;
  industry?: string;
  q?: string;
  pageSize: number;
};

type PaginationMeta = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
};

type Props = {
  rows: CompanyContactRow[];
  tenantSlug: string;
  timezone: string;
  queryState: QueryState;
  pagination: PaginationMeta;
};

export function CompanyInteractionsTable({
  rows,
  tenantSlug,
  timezone,
  queryState,
  pagination,
}: Props) {
  const pageHref = (page: number) =>
    buildSearchHref(
      {
        preset: queryState.preset,
        scope: queryState.scope,
        type: queryState.type,
        authorId: queryState.authorId,
        leadStatus: queryState.leadStatus,
        leadOwnerId: queryState.leadOwnerId,
        city: queryState.city,
        country: queryState.country,
        industry: queryState.industry,
        q: queryState.q,
        pageSize: queryState.pageSize,
      },
      { page },
    );

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card py-12 text-center">
        <Building2 className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium">Sin empresas contactadas</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No se encontraron interacciones con los filtros seleccionados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Canales</th>
              <th className="px-4 py-3 text-right font-medium">Contactos</th>
              <th className="px-4 py-3 font-medium">Primer contacto</th>
              <th className="px-4 py-3 font-medium">Último contacto</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const statusIndex = LEAD_STATUS_ORDER.indexOf(row.leadStatus);
              const lastContactDate = new Date(row.lastContactAt);
              const firstContactDate = new Date(row.firstContactAt);
              return (
                <tr
                  key={row.leadId}
                  className="border-b last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${tenantSlug}/leads/${row.leadId}`}
                      className="block font-medium text-foreground hover:text-primary"
                    >
                      {row.businessName}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {row.ruc && <span className="font-mono">{row.ruc}</span>}
                      {row.city && <span>· {row.city}</span>}
                      {row.industry && <span>· {row.industry}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getLeadStatusVariant(row.leadStatus)}>
                      {LEAD_STATUS_LABEL[row.leadStatus]}
                    </Badge>
                    {statusIndex >= 0 && row.leadStatus !== 'NEW' && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Paso {statusIndex + 1} de {LEAD_STATUS_ORDER.length}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.leadOwnerName ? (
                      <span className="text-foreground">{row.leadOwnerName}</span>
                    ) : (
                      <span className="text-muted-foreground">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.channels.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        row.channels.map((type) => (
                          <span
                            key={type}
                            title={INTERACTION_LABEL[type]}
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full',
                              TYPE_ICON_CLASS[type],
                            )}
                          >
                            {TYPE_ICON[type]}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold tabular-nums">{row.totalInteractions}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{formatDate(firstContactDate, timezone)}</span>
                      <span className="text-xs">{formatRelativeTime(firstContactDate)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {formatDateTime(lastContactDate, timezone)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(lastContactDate)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${tenantSlug}/leads/${row.leadId}`}>Ver lead</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
