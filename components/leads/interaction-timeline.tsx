import type { InteractionType } from '@prisma/client';
import { Mail, MessageCircle, MessageSquare, Phone, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AddInteractionDialog } from '@/components/leads/add-interaction-dialog';
import { EditInteractionDialog } from '@/components/leads/edit-interaction-dialog';
import { DeleteInteractionButton } from '@/components/leads/delete-interaction-button';

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

const TYPE_COLOR: Record<InteractionType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CALL: 'default',
  EMAIL: 'secondary',
  NOTE: 'outline',
  VISIT: 'default',
  WHATSAPP: 'secondary',
};

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
}: InteractionTimelineProps) {
  const sorted = [...interactions].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Interacciones{' '}
          {interactions.length > 0 && (
            <span className="text-muted-foreground font-normal">({interactions.length})</span>
          )}
        </h3>
        {canCreate && <AddInteractionDialog tenantSlug={tenantSlug} leadId={leadId} />}
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Sin interacciones registradas.{' '}
          {canCreate && 'Registra la primera llamada, nota o visita.'}
        </p>
      ) : (
        <ol className="space-y-3">
          {sorted.map((item) => {
            const canAct = canActOnInteraction(
              item.authorId,
              currentUserId,
              currentRole,
              isSuperAdmin,
            );
            const authorLabel = item.author.name ?? item.author.email;

            return (
              <li key={item.id} className="bg-muted/40 rounded-lg border px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={TYPE_COLOR[item.type]} className="gap-1 text-xs">
                        {TYPE_ICON[item.type]}
                        {TYPE_LABEL[item.type]}
                      </Badge>
                      {item.subject && <span className="truncate font-medium">{item.subject}</span>}
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                      <span>{authorLabel}</span>
                      <span>·</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <time dateTime={item.occurredAt.toISOString()}>
                            {formatRelative(new Date(item.occurredAt))}
                          </time>
                        </TooltipTrigger>
                        <TooltipContent>{formatAbsolute(new Date(item.occurredAt))}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {canAct && (
                    <div className="flex shrink-0 items-center gap-1">
                      <EditInteractionDialog tenantSlug={tenantSlug} interaction={item} />
                      <DeleteInteractionButton tenantSlug={tenantSlug} interactionId={item.id} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
