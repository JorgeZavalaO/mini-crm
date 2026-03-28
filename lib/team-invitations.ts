import { createHash, randomBytes } from 'node:crypto';

export const TEAM_INVITATION_TTL_DAYS = 7;

export type TeamInvitationLike = {
  acceptedAt: Date | null;
  canceledAt: Date | null;
  expiresAt: Date;
};

export type TeamInvitationStatus = 'PENDING' | 'ACCEPTED' | 'CANCELED' | 'EXPIRED';

export const TEAM_INVITATION_STATUS_LABEL: Record<TeamInvitationStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
};

export function hashTeamInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createTeamInvitationToken() {
  const rawToken = randomBytes(24).toString('hex');

  return {
    rawToken,
    tokenHash: hashTeamInvitationToken(rawToken),
  };
}

export function getTeamInvitationExpiresAt(from = new Date()) {
  return new Date(from.getTime() + TEAM_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function getTeamInvitationStatus(
  invitation: TeamInvitationLike,
  now = new Date(),
): TeamInvitationStatus {
  if (invitation.acceptedAt) return 'ACCEPTED';
  if (invitation.canceledAt) return 'CANCELED';
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'PENDING';
}

export function isTeamInvitationPending(invitation: TeamInvitationLike, now = new Date()) {
  return getTeamInvitationStatus(invitation, now) === 'PENDING';
}
