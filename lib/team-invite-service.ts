import { db } from '@/lib/db';
import {
  getTeamInvitationStatus,
  TEAM_INVITATION_STATUS_LABEL,
  type TeamInvitationStatus,
  hashTeamInvitationToken,
} from '@/lib/team-invitations';

export function formatTeamInvitationDate(value: Date) {
  return value.toLocaleString('es-PE', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type TeamInvitationListItem = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { name: string | null; email: string };
  status: TeamInvitationStatus;
  statusLabel: string;
};

export function mapTeamInvitationListItem(invitation: {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  canceledAt: Date | null;
  invitedBy: { name: string | null; email: string };
}): TeamInvitationListItem {
  const status = getTeamInvitationStatus(invitation);

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    invitedBy: invitation.invitedBy,
    status,
    statusLabel: TEAM_INVITATION_STATUS_LABEL[status],
  };
}

export async function getTeamInvitationPreviewByToken(token: string) {
  if (!token || token.trim().length < 20) {
    return null;
  }

  const invitation = await db.teamInvitation.findUnique({
    where: { tokenHash: hashTeamInvitationToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      canceledAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          deletedAt: true,
        },
      },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation || !invitation.tenant.isActive || invitation.tenant.deletedAt) {
    return null;
  }

  const status = getTeamInvitationStatus(invitation);

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    tenant: invitation.tenant,
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt,
    expiresAtLabel: formatTeamInvitationDate(invitation.expiresAt),
    status,
    statusLabel: TEAM_INVITATION_STATUS_LABEL[status],
  };
}
