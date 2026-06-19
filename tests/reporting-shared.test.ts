import { describe, expect, it } from 'vitest';
import {
  buildTimeSeries,
  computeDelta,
  formatDateInput,
  isWithinRange,
  resolveComparisonRange,
  resolveReportRange,
} from '@/lib/reporting/shared';

describe('reporting shared', () => {
  it('resuelve un rango de 7 días anclado a la fecha indicada', () => {
    const range = resolveReportRange({
      preset: '7d',
      now: new Date(2026, 5, 19, 12, 0, 0),
    });
    expect(formatDateInput(range.from)).toBe('2026-06-13');
    expect(formatDateInput(range.to)).toBe('2026-06-19');
    expect(formatDateInput(range.toExclusive)).toBe('2026-06-20');
  });

  it('resuelve el rango personalizado a las fechas indicadas', () => {
    const from = new Date(2026, 4, 1);
    const to = new Date(2026, 4, 11);
    const range = resolveReportRange({ preset: 'custom', from, to });
    expect(range.from.getTime()).toBe(from.getTime());
    expect(range.to.getTime()).toBe(to.getTime());
    expect(range.totalDays).toBe(11);
  });

  it('calcula la comparación como el período equivalente anterior', () => {
    const range = resolveReportRange({
      preset: 'custom',
      from: new Date(2026, 5, 10),
      to: new Date(2026, 5, 19),
    });
    const comparison = resolveComparisonRange(range);
    expect(formatDateInput(comparison.from)).toBe('2026-05-31');
    expect(formatDateInput(comparison.to)).toBe('2026-06-09');
    expect(comparison.totalDays).toBe(range.totalDays);
  });

  it('construye series diarias cuando el rango es corto', () => {
    const range = resolveReportRange({
      preset: '7d',
      now: new Date('2026-06-19T12:00:00Z'),
    });
    const points = [
      new Date('2026-06-15T00:00:00Z'),
      new Date('2026-06-15T00:00:00Z'),
      new Date('2026-06-17T00:00:00Z'),
    ];
    const series = buildTimeSeries(points, range);
    expect(series).toHaveLength(7);
    const withValues = series.filter((p) => p.value > 0);
    expect(withValues).toHaveLength(2);
    expect(withValues[0].value).toBe(2);
  });

  it('detecta fechas dentro del rango', () => {
    const range = resolveReportRange({
      preset: '7d',
      now: new Date('2026-06-19T12:00:00Z'),
    });
    expect(isWithinRange(new Date('2026-06-15T00:00:00Z'), range)).toBe(true);
    expect(isWithinRange(new Date('2026-06-12T00:00:00Z'), range)).toBe(false);
  });

  it('computeDelta devuelve null cuando no hay valor anterior', () => {
    const delta = computeDelta(5, 0);
    expect(delta.percent).toBe(100);
    expect(delta.direction).toBe('up');
  });

  it('computeDelta maneja decrementos', () => {
    const delta = computeDelta(3, 6);
    expect(delta.absolute).toBe(-3);
    expect(delta.percent).toBe(-50);
    expect(delta.direction).toBe('down');
  });
});
