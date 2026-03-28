'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { refreshTeamInvitationLinkAction } from '@/lib/team-invite-actions';
import { Button } from '@/components/ui/button';

type InviteLinkButtonProps = {
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
} & (
  | {
      invitePath: string;
      invitationId?: never;
      tenantSlug?: never;
    }
  | {
      invitePath?: never;
      invitationId: string;
      tenantSlug: string;
    }
);

export function InviteLinkButton({
  invitePath,
  invitationId,
  tenantSlug,
  label = 'Copiar enlace',
  variant = 'outline',
  size = 'default',
}: InviteLinkButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleCopy() {
    setLoading(true);
    try {
      const result = invitePath
        ? { invitePath, expiresAtLabel: undefined }
        : await refreshTeamInvitationLinkAction(invitationId!, tenantSlug!);
      const absoluteUrl = `${window.location.origin}${result.invitePath}`;
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success(
        result.expiresAtLabel
          ? `Enlace copiado. Vence el ${result.expiresAtLabel}`
          : 'Enlace copiado al portapapeles',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo copiar el enlace';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={handleCopy} disabled={loading}>
      {loading ? 'Preparando…' : label}
    </Button>
  );
}
