import { describe, expect, it } from 'vitest';
import { LeadStatus, ReassignmentStatus } from '@prisma/client';
import {
  acceptTeamInvitationSchema,
  createLeadSchema,
  createTeamInvitationSchema,
  importCsvSchema,
  importLeadRowSchema,
  leadContactSchema,
  leadFiltersSchema,
  mergeDuplicateLeadsSchema,
  normalizeReportDateRange,
  resolveReassignSchema,
  superadminReportFiltersSchema,
  tenantReportFiltersSchema,
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

  it('parsea filtros avanzados de ubicación y métricas', () => {
    const result = leadFiltersSchema.parse({
      country: 'Peru',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      constitutionYearMin: '2008',
      constitutionYearMax: '2020',
      employeeCountMin: '10',
      employeeCountMax: '250',
      importOperationCountMin: '1',
      importOperationCountMax: '50',
      exportOperationCountMin: '0',
      exportOperationCountMax: '12',
    });

    expect(result).toMatchObject({
      country: 'Peru',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      constitutionYearMin: 2008,
      constitutionYearMax: 2020,
      employeeCountMin: 10,
      employeeCountMax: 250,
      importOperationCountMin: 1,
      importOperationCountMax: 50,
      exportOperationCountMin: 0,
      exportOperationCountMax: 12,
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

  it('parsea dirección expandida y métricas numéricas del lead', () => {
    const result = createLeadSchema.parse({
      tenantSlug: 'acme-logistics',
      businessName: 'Acme Logistics SAC',
      country: 'Peru',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      address: 'Av. Larco 123',
      constitutionYear: '2014',
      employeeCount: '120',
      importOperationCount: '36',
      exportOperationCount: '12',
    });

    expect(result).toMatchObject({
      country: 'Peru',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      address: 'Av. Larco 123',
      constitutionYear: 2014,
      employeeCount: 120,
      importOperationCount: 36,
      exportOperationCount: 12,
    });
  });

  it('valida contactos multiples con telefonos y correos propios', () => {
    const result = createLeadSchema.parse({
      tenantSlug: 'acme-logistics',
      businessName: 'Acme Logistics SAC',
      contacts: [
        {
          name: 'Laura',
          phones: ['+51 944 100 200'],
          emails: ['LAURA@ACME.COM'],
          role: 'Compras',
          isPrimary: true,
        },
        {
          name: 'Mario',
          phones: ['+51 955 200 300', '+51 955 200 301'],
          emails: ['mario@acme.com'],
        },
      ],
    });

    expect(result.contacts).toHaveLength(2);
    expect(result.contacts?.[0]).toMatchObject({
      name: 'Laura',
      phones: ['+51 944 100 200'],
      emails: ['LAURA@ACME.COM'],
      role: 'Compras',
    });
  });

  it('rechaza contactos sin nombre, telefono ni email', () => {
    expect(() => leadContactSchema.parse({ role: 'Compras', phones: [], emails: [] })).toThrow();
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
      province: 'Lima',
      district: 'Miraflores',
      address: 'Av. Larco 123',
      constitutionYear: '2014',
      employeeCount: '120',
      importOperationCount: '36',
      exportOperationCount: '12',
      phones: ['+51 999 111 222'],
      emails: ['ventas@acme.com'],
      contacts: [
        {
          name: 'Laura',
          phones: ['+51 944 100 200'],
          emails: ['laura@acme.com'],
        },
      ],
      status: LeadStatus.CONTACTED,
      ownerEmail: 'admin@acme.com',
    });

    expect(result.ruc).toBe('20123456789');
    expect(result.ownerEmail).toBe('admin@acme.com');
    expect(result.status).toBe(LeadStatus.CONTACTED);
    expect(result.contacts).toHaveLength(1);
    expect(result.constitutionYear).toBe(2014);
    expect(result.employeeCount).toBe(120);
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

  it('normaliza filtros de reportes tenant con rango por defecto', () => {
    const result = tenantReportFiltersSchema.parse({
      tenantSlug: 'acme-logistics',
      preset: '30d',
      scope: 'all',
      ownerId: 'owner-1',
      status: 'CONTACTED',
      city: 'Lima',
    });

    expect(result).toMatchObject({
      tenantSlug: 'acme-logistics',
      preset: '30d',
      scope: 'all',
      ownerId: 'owner-1',
      status: LeadStatus.CONTACTED,
      city: 'Lima',
      page: 1,
      pageSize: 20,
    });
  });

  it('exige fechas en preset custom para reportes tenant', () => {
    expect(() =>
      tenantReportFiltersSchema.parse({
        tenantSlug: 'acme-logistics',
        preset: 'custom',
      }),
    ).toThrow();
  });

  it('usa custom como default de preset para reportes', () => {
    const result = tenantReportFiltersSchema.safeParse({ tenantSlug: 'acme-logistics' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === 'from')).toBe(true);
  });

  it('normaliza preset custom a hoy cuando no hay fechas', () => {
    const today = new Date(2026, 5, 19);
    const normalized = normalizeReportDateRange(
      tenantReportFiltersSchema.parse({
        tenantSlug: 'acme-logistics',
        preset: 'custom',
        from: today,
        to: today,
      }),
      today,
    );
    expect(normalized.from).toBeInstanceOf(Date);
    expect(normalized.to).toBeInstanceOf(Date);
  });

  it('descarta from cuando preset no es custom y conserva to', () => {
    const parsed = tenantReportFiltersSchema.parse({
      tenantSlug: 'acme-logistics',
      preset: '7d',
    });
    const today = new Date(2026, 5, 19);
    const normalized = normalizeReportDateRange(parsed, today);
    expect(normalized.from).toBeUndefined();
    expect(normalized.to).toBeInstanceOf(Date);
  });

  it('parsea filtros de reportes superadmin con feature y fechas', () => {
    const result = superadminReportFiltersSchema.parse({
      preset: 'custom',
      from: '2026-05-01',
      to: '2026-05-11',
      tenantState: 'active',
      featureKey: 'REPORTS',
    });

    expect(result.preset).toBe('custom');
    expect(result.tenantState).toBe('active');
    expect(result.featureKey).toBe('REPORTS');
    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeInstanceOf(Date);
  });
});
