import { describe, expect, it } from 'vitest';
import {
  canAssignLeads,
  canEditLead,
  canImportLeads,
  canManageDuplicateLeads,
  canResolveReassignment,
} from '@/lib/lead-permissions';

describe('lead permissions', () => {
  const supervisor = {
    userId: 'supervisor-1',
    role: 'SUPERVISOR',
    isSuperAdmin: false,
    isActiveMember: true,
  };

  const freelance = {
    userId: 'freelance-1',
    role: 'FREELANCE',
    isSuperAdmin: false,
    isActiveMember: true,
  };

  it('permite asignar y resolver reasignaciones a supervisor+', () => {
    expect(canAssignLeads(supervisor)).toBe(true);
    expect(canResolveReassignment(supervisor)).toBe(true);
    expect(canImportLeads(supervisor)).toBe(true);
    expect(canManageDuplicateLeads(supervisor)).toBe(true);
  });

  it('mantiene a freelance en modo solo lectura operacional', () => {
    expect(canAssignLeads(freelance)).toBe(false);
    expect(canResolveReassignment(freelance)).toBe(false);
    expect(canImportLeads(freelance)).toBe(false);
    expect(canManageDuplicateLeads(freelance)).toBe(false);
    expect(canEditLead(freelance, { ownerId: 'other-user' })).toBe(false);
  });

  it('permite editar un lead propio aunque el rol no pueda asignar', () => {
    expect(canEditLead(freelance, { ownerId: 'freelance-1' })).toBe(true);
  });
});
