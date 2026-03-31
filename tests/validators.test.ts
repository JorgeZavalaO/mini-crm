import { describe, expect, it } from 'vitest';
import { LeadStatus, ReassignmentStatus } from '@prisma/client';
import {
  acceptTeamInvitationSchema,
  createLeadSchema,
  createTeamInvitationSchema,
  importCsvSchema,
  importLeadRowSchema,
  leadFiltersSchema,
  mergeDuplicateLeadsSchema,
  resolveReassignSchema,
} from '@/lib/validators';

describe('lead validators', () => {
  it('normaliza filtros y aplica pageSize por defecto', () => {
    const result = leadFiltersSchema.parse({ q: ' Acme ', page: '2' });

    expect(result).toMatchObject({
      q: 'Acme',
      page: 2,
      pageSize: 20,
    });
  });

  it('valida payload mínimo de creación de lead sin owner', () => {
    const result = createLeadSchema.parse({
      tenantSlug: 'acme-logistics',
      businessName: 'Acme Logistics SAC',
      status: LeadStatus.NEW,
      phones: [],
      emails: [],
      ownerId: null,
    });

    expect(result.ownerId).toBeNull();
    expect(result.businessName).toBe('Acme Logistics SAC');
  });

  it('permite resolver reasignaciones con nota opcional y owner explícito', () => {
    const result = resolveReassignSchema.parse({
      tenantSlug: 'acme-logistics',
      requestId: 'req_123',
      status: ReassignmentStatus.APPROVED,
      ownerId: 'user_123',
      resolutionNote: 'Cobertura comercial reordenada',
    });

    expect(result).toMatchObject({
      status: ReassignmentStatus.APPROVED,
      ownerId: 'user_123',
      resolutionNote: 'Cobertura comercial reordenada',
    });
  });

  it('rechaza solicitudes de resolución sin requestId', () => {
    expect(() =>
      resolveReassignSchema.parse({
        tenantSlug: 'acme-logistics',
        requestId: '',
        status: ReassignmentStatus.REJECTED,
      }),
    ).toThrow();
  });

  it('valida payload mínimo de importación CSV', () => {
    const result = importCsvSchema.parse({
      tenantSlug: 'acme-logistics',
      csvText: 'businessName\nAcme Logistics',
    });

    expect(result.tenantSlug).toBe('acme-logistics');
    expect(result.csvText).toContain('businessName');
  });

  it('valida filas importadas ya transformadas', () => {
    const result = importLeadRowSchema.parse({
      ruc: '20123456789',
      businessName: 'Acme Logistics',
      phones: ['+51 999 111 222'],
      emails: ['ventas@acme.com'],
      status: LeadStatus.CONTACTED,
      ownerEmail: 'admin@acme.com',
    });

    expect(result.ruc).toBe('20123456789');
    expect(result.ownerEmail).toBe('admin@acme.com');
    expect(result.status).toBe(LeadStatus.CONTACTED);
  });

  it('valida merges de duplicados', () => {
    const result = mergeDuplicateLeadsSchema.parse({
      tenantSlug: 'acme-logistics',
      primaryLeadId: 'lead-1',
      duplicateLeadIds: ['lead-2', 'lead-3'],
    });

    expect(result.duplicateLeadIds).toHaveLength(2);
  });

  it('valida creación de invitaciones de equipo', () => {
    const result = createTeamInvitationSchema.parse({
      tenantId: 'tenant-1',
      tenantSlug: 'acme-logistics',
      email: 'INVITADO@ACME.COM',
      role: 'SUPERVISOR',
    });

    expect(result.email).toBe('invitado@acme.com');
    expect(result.role).toBe('SUPERVISOR');
  });

  it('valida aceptación de invitaciones y exige contraseñas coincidentes', () => {
    const result = acceptTeamInvitationSchema.parse({
      token: '12345678901234567890token',
      name: 'María Equipo',
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    expect(result.name).toBe('María Equipo');

    expect(() =>
      acceptTeamInvitationSchema.parse({
        token: '12345678901234567890token',
        name: 'María Equipo',
        password: 'secret123',
        confirmPassword: 'otra123',
      }),
    ).toThrow();
  });
});
