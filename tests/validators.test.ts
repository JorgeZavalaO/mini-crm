import { describe, expect, it } from 'vitest';
import { LeadStatus, ReassignmentStatus } from '@prisma/client';
import { createLeadSchema, leadFiltersSchema, resolveReassignSchema } from '@/lib/validators';

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
});
