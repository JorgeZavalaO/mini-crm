import { describe, expect, it } from 'vitest';
import {
  buildDuplicateGroupsByCriterion,
  buildMergedLeadData,
  findDuplicateGroups,
  summarizeDuplicateGroups,
} from '@/lib/dedupe-utils';

const leadA = {
  id: 'lead-a',
  businessName: 'Acme Logistics',
  ruc: '20123456789',
  rucNormalized: '20123456789',
  nameNormalized: 'acme logistics',
  country: 'Peru',
  city: 'Lima',
  industry: 'Logistica',
  source: 'Web',
  notes: 'Nota inicial',
  phones: ['+51 999 111 222'],
  emails: ['ventas@acme.com'],
  status: 'NEW' as const,
  ownerId: 'owner-a',
};

const leadB = {
  id: 'lead-b',
  businessName: 'Acme Logistics SAC',
  ruc: '20123456789',
  rucNormalized: '20123456789',
  nameNormalized: 'acme logistics sac',
  country: null,
  city: 'Lima',
  industry: null,
  source: 'Referido',
  notes: 'Nota complementaria',
  phones: ['+51 955 888 777'],
  emails: ['gerencia@acme.com'],
  status: 'CONTACTED' as const,
  ownerId: null,
};

describe('dedupe utils', () => {
  it('detecta grupos duplicados por RUC', () => {
    const groups = findDuplicateGroups([leadA, leadB], 'RUC');

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      criterion: 'RUC',
      matchValue: '20123456789',
    });
    expect(groups[0].leads.map((lead) => lead.id)).toEqual(['lead-a', 'lead-b']);
  });

  it('detecta grupos duplicados por nombre normalizado', () => {
    const groups = findDuplicateGroups(
      [
        leadA,
        {
          ...leadB,
          id: 'lead-c',
          businessName: 'Acme Logistics',
          nameNormalized: 'acme logistics',
        },
      ],
      'NAME',
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].matchValue).toBe('acme logistics');
  });

  it('fusiona teléfonos, correos, notas y campos vacíos hacia el lead principal', () => {
    const merged = buildMergedLeadData(leadA, [leadB]);

    expect(merged.ruc).toBe('20123456789');
    expect(merged.city).toBe('Lima');
    expect(merged.source).toBe('Web');
    expect(merged.ownerId).toBe('owner-a');
    expect(merged.phones).toEqual(['+51 999 111 222', '+51 955 888 777']);
    expect(merged.emails).toEqual(['ventas@acme.com', 'gerencia@acme.com']);
    expect(merged.notes).toContain('Nota inicial');
    expect(merged.notes).toContain('Nota complementaria');
    expect(merged.notes).toContain('Fusión realizada con: Acme Logistics SAC');
  });

  it('resume grupos y leads en riesgo sin duplicar conteos por criterio', () => {
    const groups = buildDuplicateGroupsByCriterion([
      leadA,
      leadB,
      {
        ...leadB,
        id: 'lead-c',
        ruc: null,
        rucNormalized: null,
        businessName: 'Acme Logistics',
        nameNormalized: 'acme logistics',
        emails: ['ventas@acme.com'],
        phones: ['+51 955 888 777'],
      },
    ]);

    const summary = summarizeDuplicateGroups(groups);

    expect(summary.totalGroups).toBeGreaterThanOrEqual(2);
    expect(summary.totalLeadsAtRisk).toBe(3);
    expect(summary.byCriterion.RUC).toBe(1);
    expect(summary.byCriterion.EMAIL).toBeGreaterThanOrEqual(1);
  });
});
