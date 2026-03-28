import { describe, expect, it } from 'vitest';
import {
  createTeamInvitationToken,
  getTeamInvitationExpiresAt,
  getTeamInvitationStatus,
  hashTeamInvitationToken,
} from '@/lib/team-invitations';

describe('team invitation helpers', () => {
  it('genera tokens aleatorios y hashes determinísticos', () => {
    const first = createTeamInvitationToken();
    const second = createTeamInvitationToken();

    expect(first.rawToken).not.toBe(second.rawToken);
    expect(hashTeamInvitationToken(first.rawToken)).toBe(first.tokenHash);
  });

  it('calcula expiración futura y estados derivados correctamente', () => {
    const baseDate = new Date('2026-03-28T10:00:00.000Z');
    const expiresAt = getTeamInvitationExpiresAt(baseDate);

    expect(expiresAt.getTime()).toBeGreaterThan(baseDate.getTime());

    expect(
      getTeamInvitationStatus({ acceptedAt: null, canceledAt: null, expiresAt }, baseDate),
    ).toBe('PENDING');

    expect(
      getTeamInvitationStatus(
        { acceptedAt: new Date('2026-03-28T11:00:00.000Z'), canceledAt: null, expiresAt },
        baseDate,
      ),
    ).toBe('ACCEPTED');

    expect(
      getTeamInvitationStatus(
        { acceptedAt: null, canceledAt: new Date('2026-03-28T11:00:00.000Z'), expiresAt },
        baseDate,
      ),
    ).toBe('CANCELED');

    expect(
      getTeamInvitationStatus(
        { acceptedAt: null, canceledAt: null, expiresAt: new Date('2026-03-27T10:00:00.000Z') },
        baseDate,
      ),
    ).toBe('EXPIRED');
  });
});
