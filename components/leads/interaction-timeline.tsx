import type { InteractionType, LeadStatus } from '@prisma/client';
import { Mail, MessageCircle, MessageSquare, Phone, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AddInteractionDialog } from '@/components/leads/add-interaction-dialog';
import { DeleteInteractionButton } from '@/components/leads/delete-interaction-button';
import { EditInteractionDialog } from '@/components/leads/edit-interaction-dialog';

function formatRelative(date: Date): string {
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');
  return rtf.format(diffYear, 'year');
}

function formatAbsolute(date: Date): string {
  return date.toLocaleString('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type InteractionItem = {
  id: string;
  leadId: string;
  type: InteractionType;
  subject: string | null;
  notes: string;
  occurredAt: Date;
  createdAt: Date;
  authorId: string;
  author: { name: string | null; email: string };
};

type InteractionTimelineProps = {
  interactions: InteractionItem[];
  tenantSlug: string;
  leadId: string;
  currentUserId: string;
  currentRole: string | null;
  isSuperAdmin: boolean;
  canCreate: boolean;
  currentStatus: LeadStatus;
  totalCount?: number;
};

const TYPE_ICON: Record<InteractionType, React.ReactNode> = {
  CALL: <Phone className="size-3.5" />,
  EMAIL: <Mail className="size-3.5" />,
  NOTE: <MessageSquare className="size-3.5" />,
  VISIT: <Users className="size-3.5" />,
  WHATSAPP: <MessageCircle className="size-3.5" />,
};

const TYPE_LABEL: Record<InteractionType, string> = {
  CALL: 'Llamada',
  EMAIL: 'Email',
  NOTE: 'Nota',
  VISIT: 'Visita',
  WHATSAPP: 'WhatsApp',
};

const DOT_COLOR: Record<InteractionType, string> = {
  CALL: 'bg-blue-500',
  EMAIL: 'bg-green-500',
  NOTE: 'bg-amber-500',
  VISIT: 'bg-purple-500',
  WHATSAPP: 'bg-emerald-500',
};

const ICON_BG: Record<InteractionType, string> = {
  CALL: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  EMAIL: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
  NOTE: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  VISIT: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
  WHATSAPP: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function canActOnInteraction(
  authorId: string,
  currentUserId: string,
  currentRole: string | null,
  isSuperAdmin: boolean,
) {
  if (isSuperAdmin) return true;
  if (currentUserId === authorId) return true;
  return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR';
}

export function InteractionTimeline({
  interactions,
  tenantSlug,
  leadId,
  currentUserId,
  currentRole,
  isSuperAdmin,
  canCreate,
  currentStatus,
  totalCount,
}: InteractionTimelineProps) {
  const sorted = [...interactions].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const displayCount = totalCount ?? sorted.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Interacciones</span>
          {displayCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {displayCount}
            </Badge>
          )}
        </div>
        {canCreate && sorted.length > 0 && (
          <AddInteractionDialog
            tenantSlug={tenantSlug}
            leadId={leadId}
            currentStatus={currentStatus}
          />
        )}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <MessageSquare className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Sin interacciones registradas</p>
            {canCreate && (
              <p className="text-xs text-muted-foreground">
                Registra la primera llamada, nota o visita.
              </p>
            )}
          </div>
          {canCreate && (
            <AddInteractionDialog
              tenantSlug={tenantSlug}
              leadId={leadId}
              currentStatus={currentStatus}
            />
          )}
        </div>
      )}

      {/* Timeline */}
      {sorted.length > 0 && (
        <div className="relative pl-8">
          {/* Vertical line — centered at left-3.5 (14px) */}
          <div className="absolute bottom-0 left-3.5 top-4 w-px bg-border" aria-hidden="true" />
          <ol className="space-y-4">
            {sorted.map((item) => {
              const canAct = canActOnInteraction(
                item.authorId,
                currentUserId,
                currentRole,
                isSuperAdmin,
              );
              const authorLabel = item.author.name ?? item.author.email;

              return (
                <li key={item.id} className="relative">
                  {/* Dot — center at 14px from container left (-left-6 = -24px; li left = 32px; 32-24=8; center=8+6=14px ✓) */}
                  <span
                    className={cn(
                      'absolute -left-6 top-3.5 h-3 w-3 rounded-full ring-2 ring-background',
                      DOT_COLOR[item.type],
                    )}
                    aria-hidden="true"
                  />

                  {/* Card */}
                  <div className="rounded-lg border bg-card shadow-sm">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2 p-3 pb-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <div
                          className={cn(
                            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                            ICON_BG[item.type],
                          )}
                        >
                          {TYPE_ICON[item.type]}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-xs font-semibold">{TYPE_LABEL[item.type]}</span>
                            {item.subject && (
                              <span className="truncate text-sm font-medium">{item.subject}</span>
                            )}
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <time
                                dateTime={new Date(item.occurredAt).toISOString()}
                                className="cursor-default text-xs text-muted-foreground"
                              >
                                {formatRelative(new Date(item.occurredAt))}
                              </time>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatAbsolute(new Date(item.occurredAt))}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {canAct && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <EditInteractionDialog tenantSlug={tenantSlug} interaction={item} />
                          <DeleteInteractionButton
                            tenantSlug={tenantSlug}
                            interactionId={item.id}
                            subject={item.subject}
                            type={item.type}
                          />
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <p className="whitespace-pre-wrap px-3 pb-3 text-sm text-muted-foreground">
                      {item.notes}
                    </p>

                    {/* Author footer */}
                    <div className="flex items-center gap-1.5 border-t px-3 py-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(authorLabel)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{authorLabel}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
