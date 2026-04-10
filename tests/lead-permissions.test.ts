import { describe, expect, it } from 'vitest';
import {
  canAssignLeads,
  canAssignTaskToOthers,
  canChangeQuoteStatus,
  canEditLead,
  canImportLeads,
  canManageDuplicateLeads,
  canResolveReassignment,
  canViewPortalTokens,
  canViewAllTasks,
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

  // ─── Task permissions ─────────────────────────────────

  it('permite a supervisor+ asignar tareas a otros y ver todas las tareas', () => {
    expect(canAssignTaskToOthers(supervisor)).toBe(true);
    expect(canViewAllTasks(supervisor)).toBe(true);
    expect(canViewPortalTokens(supervisor)).toBe(true);
  });

  it('no permite a roles < supervisor asignar tareas a otros ni ver todas', () => {
    expect(canAssignTaskToOthers(freelance)).toBe(false);
    expect(canViewAllTasks(freelance)).toBe(false);
    expect(canViewPortalTokens(freelance)).toBe(false);
  });

  it('permite a superAdmin asignar tareas a otros y ver todas las tareas', () => {
    const superAdmin = {
      userId: 'sa-1',
      role: null as string | null,
      isSuperAdmin: true,
      isActiveMember: true,
    };
    expect(canAssignTaskToOthers(superAdmin)).toBe(true);
    expect(canViewAllTasks(superAdmin)).toBe(true);
    expect(canViewPortalTokens(superAdmin)).toBe(true);
  });

  it('permite cambiar estado de cotización al creador sin importar rol', () => {
    expect(canChangeQuoteStatus(freelance, { createdById: 'freelance-1' })).toBe(true);
  });

  it('no permite cambiar estado a freelance no creador', () => {
    expect(canChangeQuoteStatus(freelance, { createdById: 'other-user' })).toBe(false);
  });

  it('permite cambiar estado a supervisor aunque no sea creador', () => {
    expect(canChangeQuoteStatus(supervisor, { createdById: 'other-user' })).toBe(true);
  });

  it('permite cambiar estado a superAdmin aunque no sea creador', () => {
    const superAdmin = {
      userId: 'sa-1',
      role: null as string | null,
      isSuperAdmin: true,
      isActiveMember: true,
    };

    expect(canChangeQuoteStatus(superAdmin, { createdById: 'other-user' })).toBe(true);
  });
});
