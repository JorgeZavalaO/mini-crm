'use server';

import { AppError } from '@/lib/errors';
import { compactNumber } from '@/lib/reporting/shared';
import { getSuperadminReportsData } from '@/lib/reporting/superadmin-reports';
import { getTenantReportsData } from '@/lib/reporting/tenant-reports';
import { superadminReportFiltersSchema, tenantReportFiltersSchema } from '@/lib/validators';

export type ReportExportResult = {
  success: true;
  filename: string;
  csv: string;
  rows: string[][];
  sheetName: string;
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

function buildTenantRows(data: Awaited<ReturnType<typeof getTenantReportsData>>): string[][] {
  const rows: string[][] = [['Sección', 'Métrica', 'Valor']];

  rows.push(
    ['Resumen', 'Tenant', data.tenant.name],
    ['Resumen', 'Rango', data.range.label],
    ['Resumen', 'Leads totales', String(data.summary.totalLeads)],
    ['Resumen', 'Leads nuevos en rango', String(data.summary.newLeadsInRange)],
    ['Resumen', 'Interacciones en rango', String(data.summary.interactionsInRange)],
    ['Resumen', 'Tareas abiertas', String(data.summary.openTasks)],
    ['Resumen', 'Tareas completadas en rango', String(data.summary.completedTasksInRange)],
    ['Resumen', 'Cotizaciones en rango', String(data.summary.quotesInRange)],
    ['Resumen', 'Pipeline cotizado', String(data.summary.quotePipelineAmount)],
    ['Resumen', 'Win rate', `${data.summary.winRate}%`],
  );

  for (const row of data.statusBuckets) {
    rows.push(['Pipeline', row.label, String(row.count)]);
  }

  for (const row of data.interactionTypeRows) {
    rows.push(['Interacciones', row.label, String(row.value)]);
  }

  for (const row of data.taskStatusRows) {
    rows.push(['Tareas', row.label, String(row.value)]);
  }

  for (const row of data.quoteStatusRows) {
    rows.push(['Cotizaciones', `${row.label} (conteo)`, String(row.value)]);
    rows.push(['Cotizaciones', `${row.label} (monto)`, String(row.amount)]);
  }

  for (const row of data.topCities) {
    rows.push(['Clientes', `Ciudad · ${row.label}`, String(row.value)]);
  }

  for (const row of data.topSources) {
    rows.push(['Clientes', `Fuente · ${row.label}`, String(row.value)]);
  }

  for (const row of data.topIndustries) {
    rows.push(['Clientes', `Industria · ${row.label}`, String(row.value)]);
  }

  for (const row of data.ownerPerformance) {
    rows.push(['Equipo', `${row.label} · leads`, String(row.leads)]);
    rows.push(['Equipo', `${row.label} · ganados`, String(row.won)]);
  }

  return rows;
}

function buildSuperadminRows(
  data: Awaited<ReturnType<typeof getSuperadminReportsData>>,
): string[][] {
  const rows: string[][] = [['Sección', 'Métrica', 'Valor']];

  rows.push(
    ['Resumen', 'Rango', data.range.label],
    ['Resumen', 'Tenants en alcance', String(data.summary.tenantsInScope)],
    ['Resumen', 'Tenants activos', String(data.summary.activeTenants)],
    ['Resumen', 'Usuarios activos', String(data.summary.usersInScope)],
    ['Resumen', 'Leads en rango', String(data.summary.leadsInRange)],
    ['Resumen', 'Interacciones en rango', String(data.summary.interactionsInRange)],
    ['Resumen', 'Tareas abiertas', String(data.summary.openTasks)],
    ['Resumen', 'Cotizaciones en rango', String(data.summary.quotesInRange)],
    ['Resumen', 'Volumen cotizado', String(data.summary.quoteVolume)],
    ['Resumen', 'Aceptación de cotizaciones', `${data.summary.quoteAcceptanceRate}%`],
  );

  for (const row of data.tenantLifecycleRows) {
    rows.push(['Tenants', row.label, String(row.value)]);
  }

  for (const row of data.planDistribution) {
    rows.push(['Planes', row.label, String(row.value)]);
  }

  for (const row of data.featureAdoption) {
    rows.push(['Adopción módulos', row.label, String(row.value)]);
  }

  for (const row of data.topTenantsByLeads) {
    rows.push(['Top tenants', row.label, String(row.value)]);
  }

  for (const row of data.taskStatusRows) {
    rows.push(['Tareas', row.label, String(row.value)]);
  }

  for (const row of data.quoteStatusRows) {
    rows.push(['Cotizaciones', `${row.label} (conteo)`, String(row.value)]);
    rows.push(['Cotizaciones', `${row.label} (monto)`, String(row.amount)]);
  }

  return rows;
}

export async function exportTenantReportsAction(input: unknown): Promise<ReportExportResult> {
  const parsed = tenantReportFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros de reporte inválidos', 400);
  }

  const data = await getTenantReportsData(parsed.data);
  const rows = buildTenantRows(data);
  const csv = toCsv(rows);
  const date = new Date().toISOString().slice(0, 10);
  const scope = data.actor.appliedScope === 'mine' ? 'mi-vista' : 'tenant';

  return {
    success: true,
    filename: `reportes_${data.tenant.slug}_${scope}_${date}`,
    csv,
    rows,
    sheetName: `Reportes ${compactNumber(rows.length - 1)}`,
  };
}

export async function exportSuperadminReportsAction(input: unknown): Promise<ReportExportResult> {
  const parsed = superadminReportFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros de reporte inválidos', 400);
  }

  const data = await getSuperadminReportsData(parsed.data);
  const rows = buildSuperadminRows(data);
  const csv = toCsv(rows);
  const date = new Date().toISOString().slice(0, 10);

  return {
    success: true,
    filename: `reportes_superadmin_${date}`,
    csv,
    rows,
    sheetName: `Global ${compactNumber(rows.length - 1)}`,
  };
}
