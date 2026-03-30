import { describe, expect, it } from 'vitest';
import { hasRole, isRole } from '@/lib/rbac';

describe('hasRole', () => {
  it('retorna true cuando el rol del usuario supera el requerido', () => {
    expect(hasRole('ADMIN', 'VENDEDOR')).toBe(true);
    expect(hasRole('SUPERVISOR', 'PASANTE')).toBe(true);
    expect(hasRole('VENDEDOR', 'FREELANCE')).toBe(true);
  });

  it('retorna true cuando el rol del usuario es exactamente el requerido', () => {
    expect(hasRole('ADMIN', 'ADMIN')).toBe(true);
    expect(hasRole('SUPERVISOR', 'SUPERVISOR')).toBe(true);
    expect(hasRole('PASANTE', 'PASANTE')).toBe(true);
  });

  it('retorna false cuando el rol del usuario está por debajo del requerido', () => {
    expect(hasRole('PASANTE', 'ADMIN')).toBe(false);
    expect(hasRole('VENDEDOR', 'SUPERVISOR')).toBe(false);
    expect(hasRole('FREELANCE', 'VENDEDOR')).toBe(false);
    expect(hasRole('SUPERVISOR', 'ADMIN')).toBe(false);
  });

  it('retorna false para null o undefined', () => {
    expect(hasRole(null, 'PASANTE')).toBe(false);
    expect(hasRole(undefined, 'PASANTE')).toBe(false);
  });

  it('retorna false para roles desconocidos', () => {
    expect(hasRole('ROL_INVALIDO', 'PASANTE')).toBe(false);
    expect(hasRole('', 'PASANTE')).toBe(false);
  });
});

describe('isRole', () => {
  it('retorna true cuando el rol coincide exactamente', () => {
    expect(isRole('ADMIN', 'ADMIN')).toBe(true);
    expect(isRole('PASANTE', 'PASANTE')).toBe(true);
    expect(isRole('SUPERVISOR', 'SUPERVISOR')).toBe(true);
  });

  it('retorna false cuando el rol no coincide, aunque sea superior', () => {
    expect(isRole('ADMIN', 'SUPERVISOR')).toBe(false);
    expect(isRole('SUPERVISOR', 'ADMIN')).toBe(false);
    expect(isRole('VENDEDOR', 'ADMIN')).toBe(false);
  });

  it('retorna false para null o undefined', () => {
    expect(isRole(null, 'ADMIN')).toBe(false);
    expect(isRole(undefined, 'ADMIN')).toBe(false);
  });
});
