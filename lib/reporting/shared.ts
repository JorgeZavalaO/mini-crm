import type { FeatureKey } from '@prisma/client';
import { FEATURE_LABEL } from '@/lib/feature-catalog';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/lib/lead-status';
import type { REPORT_PRESETS } from '@/lib/validators';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

export type ResolvedReportRange = {
  preset: ReportPreset;
  from: Date;
  to: Date;
  toExclusive: Date;
  totalDays: number;
  label: string;
};

export type MetricDatum = {
  label: string;
  value: number;
};

export type MetricWithAmountDatum = MetricDatum & {
  amount?: number;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function formatHumanDate(date: Date) {
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveReportRange(input: {
  preset: ReportPreset;
  from?: Date;
  to?: Date;
  now?: Date;
}): ResolvedReportRange {
  const today = startOfDay(input.now ?? new Date());
  const to = input.to ? startOfDay(input.to) : today;

  let from = input.from ? startOfDay(input.from) : to;
  let label = '';

  switch (input.preset) {
    case '7d':
      from = addDays(to, -6);
      label = 'Últimos 7 días';
      break;
    case '30d':
      from = addDays(to, -29);
      label = 'Últimos 30 días';
      break;
    case '90d':
      from = addDays(to, -89);
      label = 'Últimos 90 días';
      break;
    case 'month':
      from = startOfMonth(to);
      label = 'Mes actual';
      break;
    case 'quarter':
      from = startOfQuarter(to);
      label = 'Trimestre actual';
      break;
    case 'year':
      from = startOfYear(to);
      label = 'Año actual';
      break;
    case 'custom':
      label = `${formatHumanDate(from)} → ${formatHumanDate(to)}`;
      break;
    default:
      label = 'Rango personalizado';
      break;
  }

  const toExclusive = addDays(to, 1);
  const totalDays = Math.max(1, Math.round((toExclusive.getTime() - from.getTime()) / DAY_MS));

  return {
    preset: input.preset,
    from,
    to,
    toExclusive,
    totalDays,
    label,
  };
}

export function isWithinRange(date: Date, range: ResolvedReportRange) {
  return date >= range.from && date < range.toExclusive;
}

export function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

export function incrementCounter(
  map: Map<string, number>,
  key: string | null | undefined,
  amount = 1,
) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function toTopMetrics(map: Map<string, number>, limit = 6): MetricDatum[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

export function buildTimeSeries(points: Date[], range: ResolvedReportRange): MetricDatum[] {
  if (points.length === 0) return [];

  if (range.totalDays <= 31) {
    const fmt = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' });
    const keyToLabel = new Map<string, string>();
    const counts = new Map<string, number>();

    for (
      let cursor = new Date(range.from);
      cursor < range.toExclusive;
      cursor = addDays(cursor, 1)
    ) {
      const key = formatDateInput(cursor);
      keyToLabel.set(key, fmt.format(cursor));
      counts.set(key, 0);
    }

    for (const point of points) {
      const key = formatDateInput(point);
      if (!counts.has(key)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()].map(([key, value]) => ({
      label: keyToLabel.get(key) ?? key,
      value,
    }));
  }

  if (range.totalDays <= 120) {
    const fmt = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' });
    const buckets: Array<{ start: Date; end: Date; label: string; value: number }> = [];

    for (
      let cursor = new Date(range.from);
      cursor < range.toExclusive;
      cursor = addDays(cursor, 7)
    ) {
      const end = addDays(cursor, 6);
      buckets.push({
        start: new Date(cursor),
        end,
        label: `${fmt.format(cursor)} · ${fmt.format(end > range.to ? range.to : end)}`,
        value: 0,
      });
    }

    for (const point of points) {
      const diff = Math.floor((startOfDay(point).getTime() - range.from.getTime()) / DAY_MS);
      if (diff < 0) continue;
      const bucketIndex = Math.floor(diff / 7);
      if (!buckets[bucketIndex]) continue;
      buckets[bucketIndex].value += 1;
    }

    return buckets.map((bucket) => ({ label: bucket.label, value: bucket.value }));
  }

  const fmt = new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit' });
  const counts = new Map<string, MetricDatum>();

  for (
    let cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
    cursor < range.toExclusive;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, { label: fmt.format(cursor), value: 0 });
  }

  for (const point of points) {
    const key = `${point.getFullYear()}-${String(point.getMonth() + 1).padStart(2, '0')}`;
    const bucket = counts.get(key);
    if (!bucket) continue;
    bucket.value += 1;
  }

  return [...counts.values()];
}

export function buildLeadStatusMetrics(statusMap: Partial<Record<string, number>>) {
  return LEAD_STATUS_ORDER.map((status) => ({
    status,
    label: LEAD_STATUS_LABEL[status],
    count: statusMap[status] ?? 0,
  }));
}

export function featureKeyToLabel(featureKey: FeatureKey) {
  return FEATURE_LABEL[featureKey] ?? featureKey;
}
