import { describe, expect, it } from 'vitest';
import {
  canOwnLeads,
  getAssignableLeadOwnerOptions,
  isAssignableLeadOwner,
} from '@/lib/lead-owner';

describe('lead-owner rules', () => {
  it('permite ownership a admin, supervisor y vendedor', () => {
    expect(canOwnLeads('ADMIN')).toBe(true);
    expect(canOwnLeads('SUPERVISOR')).toBe(true);
    expect(canOwnLeads('VENDEDOR')).toBe(true);
  });

  it('bloquea ownership a freelance, pasante o rol indefinido', () => {
    expect(canOwnLeads('FREELANCE')).toBe(false);
    expect(canOwnLeads('PASANTE')).toBe(false);
    expect(canOwnLeads(undefined)).toBe(false);
    expect(canOwnLeads(null)).toBe(false);
  });

  it('solo considera asignables a miembros activos con rol vendedor o superior', () => {
    expect(isAssignableLeadOwner({ role: 'VENDEDOR', isActive: true })).toBe(true);
    expect(isAssignableLeadOwner({ role: 'SUPERVISOR', isActive: true })).toBe(true);
    expect(isAssignableLeadOwner({ role: 'FREELANCE', isActive: true })).toBe(false);
    expect(isAssignableLeadOwner({ role: 'ADMIN', isActive: false })).toBe(false);
  });

  it('genera opciones de owner solo para miembros elegibles', () => {
    const options = getAssignableLeadOwnerOptions([
      {
        role: 'ADMIN',
        isActive: true,
        user: { id: '1', name: 'Ada', email: 'ada@example.com' },
      },
      {
        role: 'FREELANCE',
        isActive: true,
        user: { id: '2', name: 'Bob', email: 'bob@example.com' },
      },
      {
        role: 'VENDEDOR',
        isActive: false,
        user: { id: '3', name: 'Carla', email: 'carla@example.com' },
      },
      {
        role: 'SUPERVISOR',
        isActive: true,
        user: { id: '4', name: null, email: 'supervisor@example.com' },
      },
    ]);

    expect(options).toEqual([
      { id: '1', name: 'Ada', email: 'ada@example.com', role: 'ADMIN' },
      { id: '4', name: '', email: 'supervisor@example.com', role: 'SUPERVISOR' },
    ]);
  });
});
