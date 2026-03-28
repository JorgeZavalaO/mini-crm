import { describe, expect, it } from 'vitest';
import {
  buildLeadStatusBuckets,
  getLeadStatusVariant,
  getReassignmentStatusVariant,
  LEAD_STATUS_LABEL,
  REASSIGNMENT_STATUS_LABEL,
} from '@/lib/lead-status';

describe('lead status presentation helpers', () => {
  it('construye buckets completos y en orden estable aunque falten estados', () => {
    const buckets = buildLeadStatusBuckets([
      { status: 'CONTACTED', _count: { _all: 2 } },
      { status: 'NEW', _count: { _all: 5 } },
      { status: 'WON', _count: { _all: 1 } },
    ]);

    expect(buckets.map((bucket) => [bucket.status, bucket.count])).toEqual([
      ['NEW', 5],
      ['CONTACTED', 2],
      ['QUALIFIED', 0],
      ['WON', 1],
      ['LOST', 0],
    ]);
  });

  it('expone etiquetas y variantes consistentes para estados de lead', () => {
    expect(LEAD_STATUS_LABEL.NEW).toBe('Nuevo');
    expect(LEAD_STATUS_LABEL.WON).toBe('Ganado');
    expect(getLeadStatusVariant('NEW')).toBe('outline');
    expect(getLeadStatusVariant('QUALIFIED')).toBe('secondary');
    expect(getLeadStatusVariant('LOST')).toBe('destructive');
  });

  it('expone etiquetas y variantes consistentes para reasignaciones', () => {
    expect(REASSIGNMENT_STATUS_LABEL.PENDING).toBe('Pendiente');
    expect(REASSIGNMENT_STATUS_LABEL.APPROVED).toBe('Aprobada');
    expect(getReassignmentStatusVariant('PENDING')).toBe('outline');
    expect(getReassignmentStatusVariant('APPROVED')).toBe('secondary');
    expect(getReassignmentStatusVariant('REJECTED')).toBe('destructive');
  });
});
