'use server';

import { AppError } from '@/lib/errors';
import { sectionsToRows, type ReportExportSection } from '@/lib/reporting/report-export-utils';
import { compactNumber, formatDateInput } from '@/lib/reporting/shared';
import { getSuperadminReportsData } from '@/lib/reporting/superadmin-reports';
import { getTenantReportsData } from '@/lib/reporting/tenant-reports';
import {
  normalizeReportDateRange,
  superadminReportFiltersSchema,
  tenantReportFiltersSchema,
} from '@/lib/validators';

export type ReportExportResult = {
  success: true;
  filename: string;
  csv: string;
  rows: string[][];
  sheetName: string;
  title: string;
  contextLine: string;
  rangeLabel: string;
  comparisonRangeLabel: string;
  generatedAtLabel: string;
  sections: ReportExportSection[];
};

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n');
}

function buildTenantSections(
  data: Awaited<ReturnType<typeof getTenantReportsData>>,
): ReportExportSection[] {
  const summaryRows: string[][] = [
    ['Tenant', data.tenant.name],
    ['Rango', data.range.label],
    ['Comparado contra', data.comparisonRange.label],
    ['Leads totales (segmento)', String(data.summary.totalLeads)],
    [
      'Leads nuevos en rango',
      `${data.summary.newLeadsInRange} (vs ${data.summary.newLeadsInRangeDelta.previous})`,
    ],
    [
      'Interacciones en rango',
      `${data.summary.interactionsInRange} (vs ${data.summary.interactionsInRangeDelta.previous})`,
    ],
    ['Tareas abiertas', String(data.summary.openTasks)],
    [
      'Tareas completadas en rango',
      `${data.summary.completedTasksInRange} (vs ${data.summary.completedTasksInRangeDelta.previous})`,
    ],
    [
      'Cotizaciones en rango',
      `${data.summary.quotesInRange} (vs ${data.summary.quotesInRangeDelta.previous})`,
    ],
    ['Pipeline cotizado', String(data.summary.quotePipelineAmount)],
    ['Win rate', `${data.summary.winRate}%`],
  ];

  return [
    { title: 'Resumen', header: ['Métrica', 'Valor'], rows: summaryRows },
    {
      title: 'Pipeline',
      header: ['Estado', 'Cantidad'],
      rows: data.statusBuckets.map((bucket) => [bucket.label, String(bucket.count)]),
    },
    {
      title: 'Interacciones por canal',
      header: ['Canal', 'Cantidad'],
      rows: data.interactionTypeRows.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Tareas por estado',
      header: ['Estado', 'Cantidad'],
      rows: data.taskStatusRows.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Cotizaciones por estado',
      header: ['Estado', 'Cantidad', 'Monto (S/)'],
      rows: data.quoteStatusRows.map((row) => [row.label, String(row.value), String(row.amount)]),
    },
    {
      title: 'Top ciudades',
      header: ['Ciudad', 'Leads'],
      rows: data.topCities.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Top fuentes',
      header: ['Fuente', 'Leads'],
      rows: data.topSources.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Top industrias',
      header: ['Industria', 'Leads'],
      rows: data.topIndustries.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Desempeño del equipo',
      header: ['Responsable', 'Leads', 'Ganados'],
      rows: data.ownerPerformance.map((row) => [row.label, String(row.leads), String(row.won)]),
    },
  ];
}

function buildSuperadminSections(
  data: Awaited<ReturnType<typeof getSuperadminReportsData>>,
): ReportExportSection[] {
  const summaryRows: string[][] = [
    ['Rango', data.range.label],
    ['Comparado contra', data.comparisonRange.label],
    ['Tenants en alcance', String(data.summary.tenantsInScope)],
    ['Tenants activos', String(data.summary.activeTenants)],
    ['Usuarios activos', String(data.summary.usersInScope)],
    [
      'Leads en rango',
      `${data.summary.leadsInRange} (vs ${data.summary.leadsInRangeDelta.previous})`,
    ],
    [
      'Interacciones en rango',
      `${data.summary.interactionsInRange} (vs ${data.summary.interactionsInRangeDelta.previous})`,
    ],
    ['Tareas abiertas', String(data.summary.openTasks)],
    [
      'Cotizaciones en rango',
      `${data.summary.quotesInRange} (vs ${data.summary.quotesInRangeDelta.previous})`,
    ],
    [
      'Volumen cotizado',
      `${data.summary.quoteVolume} (vs ${data.summary.quoteVolumeDelta.previous})`,
    ],
    ['Aceptación de cotizaciones', `${data.summary.quoteAcceptanceRate}%`],
  ];

  return [
    { title: 'Resumen', header: ['Métrica', 'Valor'], rows: summaryRows },
    {
      title: 'Estado de tenants',
      header: ['Estado', 'Cantidad'],
      rows: data.tenantLifecycleRows.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Distribución por plan',
      header: ['Plan', 'Tenants'],
      rows: data.planDistribution.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Adopción de módulos',
      header: ['Módulo', 'Tenants'],
      rows: data.featureAdoption.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Top tenants por captación',
      header: ['Tenant', 'Leads'],
      rows: data.topTenantsByLeads.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Tareas por estado',
      header: ['Estado', 'Cantidad'],
      rows: data.taskStatusRows.map((row) => [row.label, String(row.value)]),
    },
    {
      title: 'Cotizaciones por estado',
      header: ['Estado', 'Cantidad', 'Monto (S/)'],
      rows: data.quoteStatusRows.map((row) => [row.label, String(row.value), String(row.amount)]),
    },
  ];
}

function formatGeneratedAt(date: Date) {
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function exportTenantReportsAction(input: unknown): Promise<ReportExportResult> {
  const parsed = tenantReportFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros de reporte inválidos', 400);
  }

  const data = await getTenantReportsData(normalizeReportDateRange(parsed.data));
  const sections = buildTenantSections(data);
  const flatRows = sectionsToRows(`Reporte ${data.tenant.name}`, sections);
  const csv = toCsv(flatRows);
  const date = formatDateInput(new Date());
  const scope = data.actor.appliedScope === 'mine' ? 'mi-vista' : 'tenant';
  const title = `Reporte ${data.tenant.name}`;
  const contextParts: string[] = [];
  if (data.actor.appliedScope === 'mine') contextParts.push('Vista personal');
  else if (data.filters.ownerId) contextParts.push('Filtrado por responsable');
  else contextParts.push('Vista global del tenant');

  return {
    success: true,
    filename: `reportes_${data.tenant.slug}_${scope}_${date}`,
    csv,
    rows: flatRows,
    sheetName: `Reportes ${compactNumber(flatRows.length - 1)}`,
    title,
    contextLine: contextParts.join(' · '),
    rangeLabel: data.range.label,
    comparisonRangeLabel: data.comparisonRange.label,
    generatedAtLabel: formatGeneratedAt(new Date()),
    sections,
  };
}

export async function exportSuperadminReportsAction(input: unknown): Promise<ReportExportResult> {
  const parsed = superadminReportFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros de reporte inválidos', 400);
  }

  const data = await getSuperadminReportsData(normalizeReportDateRange(parsed.data));
  const sections = buildSuperadminSections(data);
  const flatRows = sectionsToRows('Reporte global superadmin', sections);
  const csv = toCsv(flatRows);
  const date = formatDateInput(new Date());
  const title = 'Reporte global superadmin';
  const contextParts: string[] = [];
  contextParts.push(`Estado tenant: ${data.filters.tenantState}`);
  if (data.filters.planId) contextParts.push('Filtrado por plan');
  if (data.filters.featureKey) contextParts.push('Filtrado por módulo');

  return {
    success: true,
    filename: `reportes_superadmin_${date}`,
    csv,
    rows: flatRows,
    sheetName: `Global ${compactNumber(flatRows.length - 1)}`,
    title,
    contextLine: contextParts.join(' · '),
    rangeLabel: data.range.label,
    comparisonRangeLabel: data.comparisonRange.label,
    generatedAtLabel: formatGeneratedAt(new Date()),
    sections,
  };
}
