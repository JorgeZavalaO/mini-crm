'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { assertTenantFeatureById, getTenantActionContextBySlug } from '@/lib/auth-guard';
import { canOwnLeads } from '@/lib/lead-owner';
import { canAssignLeads, canImportLeads } from '@/lib/lead-permissions';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { isTenantFeatureEnabled } from '@/lib/feature-service';
import { mapCsvRecordToImportRow, parseImportCsvRecords } from '@/lib/import-utils';
import {
  normalizeEmails,
  normalizeLeadName,
  normalizePhones,
  normalizeRuc,
} from '@/lib/lead-normalization';
import { importCsvSchema, importLeadRowSchema } from '@/lib/validators';

type LeadActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

type ImportRowResult = {
  rowNumber: number;
  businessName: string;
  ruc: string;
  outcome: 'READY' | 'CREATED' | 'SKIPPED' | 'ERROR';
  message: string;
};

type ImportLeadRow = ReturnType<typeof importLeadRowSchema.parse>;

type NormalizedImportRow = {
  rucNormalized: string | null;
  nameNormalized: string;
  emails: string[];
  phones: string[];
};

type PreparedImportRow = {
  rowNumber: number;
  row: ImportLeadRow;
  normalized: NormalizedImportRow;
  ownerId: string | null;
};

type ImportExecutionPlanRow = ImportRowResult & {
  createData?: Prisma.LeadUncheckedCreateInput;
};

type ExistingDuplicateLookup = {
  byRuc: Map<string, string>;
  byEmail: Map<string, string>;
  byPhone: Map<string, string>;
};

function toLeadActorContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
): LeadActorContext {
  return {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

async function assertImportEnabled(tenantId: string) {
  try {
    await assertTenantFeatureById(tenantId, 'IMPORT');
  } catch {
    throw new AppError('La importación está deshabilitada para este tenant', 403);
  }
}

function revalidateImportViews(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/dashboard`);
  revalidatePath(`/${tenantSlug}/leads`);
  revalidatePath(`/${tenantSlug}/leads/import`);
  revalidatePath(`/${tenantSlug}/leads/dedupe`);
}

function createEmptyDuplicateLookup(): ExistingDuplicateLookup {
  return {
    byRuc: new Map<string, string>(),
    byEmail: new Map<string, string>(),
    byPhone: new Map<string, string>(),
  };
}

async function buildExistingDuplicateLookup(
  tenantId: string,
  rows: PreparedImportRow[],
): Promise<ExistingDuplicateLookup> {
  const rucs = Array.from(
    new Set(
      rows
        .map((entry) => entry.normalized.rucNormalized)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const emails = Array.from(new Set(rows.flatMap((entry) => entry.normalized.emails)));
  const phones = Array.from(new Set(rows.flatMap((entry) => entry.normalized.phones)));

  const duplicateClauses: Prisma.LeadWhereInput[] = [];

  if (rucs.length > 0) {
    duplicateClauses.push({ rucNormalized: { in: rucs } });
  }

  if (emails.length > 0) {
    duplicateClauses.push({ emails: { hasSome: emails } });
  }

  if (phones.length > 0) {
    duplicateClauses.push({ phones: { hasSome: phones } });
  }

  if (duplicateClauses.length === 0) {
    return createEmptyDuplicateLookup();
  }

  const existingLeads = await db.lead.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: duplicateClauses,
    },
    select: {
      businessName: true,
      rucNormalized: true,
      emails: true,
      phones: true,
    },
  });

  const lookup = createEmptyDuplicateLookup();

  for (const lead of existingLeads) {
    if (lead.rucNormalized && !lookup.byRuc.has(lead.rucNormalized)) {
      lookup.byRuc.set(lead.rucNormalized, lead.businessName);
    }

    for (const email of normalizeEmails(lead.emails)) {
      if (!lookup.byEmail.has(email)) {
        lookup.byEmail.set(email, lead.businessName);
      }
    }

    for (const phone of normalizePhones(lead.phones)) {
      if (!lookup.byPhone.has(phone)) {
        lookup.byPhone.set(phone, lead.businessName);
      }
    }
  }

  return lookup;
}

function getExistingDuplicateMessage(
  normalized: NormalizedImportRow,
  lookup: ExistingDuplicateLookup,
): string | null {
  if (normalized.rucNormalized) {
    const matchedBusinessName = lookup.byRuc.get(normalized.rucNormalized);
    if (matchedBusinessName) {
      return `Coincide con lead existente por RUC: ${matchedBusinessName}`;
    }
  }

  const duplicatedEmail = normalized.emails.find((email) => lookup.byEmail.has(email));
  if (duplicatedEmail) {
    return `Coincide con lead existente por email (${duplicatedEmail}): ${lookup.byEmail.get(duplicatedEmail)}`;
  }

  const duplicatedPhone = normalized.phones.find((phone) => lookup.byPhone.has(phone));
  if (duplicatedPhone) {
    return `Coincide con lead existente por teléfono (${duplicatedPhone}): ${lookup.byPhone.get(duplicatedPhone)}`;
  }

  return null;
}

function buildImportCreateData(
  tenantId: string,
  row: ImportLeadRow,
  normalized: NormalizedImportRow,
  ownerId: string | null,
): Prisma.LeadUncheckedCreateInput {
  return {
    businessName: (row.businessName?.trim() || row.ruc).trim(),
    ruc: row.ruc.trim(),
    rucNormalized: normalized.rucNormalized,
    nameNormalized: normalized.nameNormalized,
    country: row.country ?? null,
    city: row.city ?? null,
    industry: row.industry ?? null,
    source: row.source ?? null,
    notes: row.notes ?? null,
    phones: normalized.phones,
    emails: normalized.emails,
    status: row.status,
    ownerId,
    tenantId,
  };
}

async function buildImportExecutionPlan(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
  actor: LeadActorContext,
  csvText: string,
): Promise<ImportExecutionPlanRow[]> {
  const assignmentsEnabled = await isTenantFeatureEnabled(ctx.tenant.id, 'ASSIGNMENTS');
  const canAssign = assignmentsEnabled && canAssignLeads(actor);

  const ownerMemberships = await db.membership.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    select: {
      role: true,
      user: { select: { id: true, email: true } },
    },
  });

  const assignableOwnerMap = new Map(
    ownerMemberships
      .filter((membership) => canOwnLeads(membership.role))
      .map((membership) => [membership.user.email.toLowerCase(), membership.user.id]),
  );

  const csvRecords = parseImportCsvRecords(csvText);
  const preparedRows: PreparedImportRow[] = [];
  const planRows: ImportExecutionPlanRow[] = [];

  for (const [index, csvRecord] of csvRecords.entries()) {
    const rowNumber = index + 2;

    try {
      const row = importLeadRowSchema.parse(mapCsvRecordToImportRow(csvRecord));
      const normalized = {
        rucNormalized: normalizeRuc(row.ruc),
        nameNormalized: normalizeLeadName(row.businessName ?? row.ruc),
        emails: normalizeEmails(row.emails),
        phones: normalizePhones(row.phones),
      };

      let ownerId: string | null = null;

      if (row.ownerEmail) {
        if (!canAssign) {
          throw new AppError('No tienes permisos para asignar owners durante la importación', 403);
        }

        ownerId = assignableOwnerMap.get(row.ownerEmail) ?? null;
        if (!ownerId) {
          throw new AppError(`No existe un owner elegible con email ${row.ownerEmail}`, 400);
        }
      }

      preparedRows.push({
        rowNumber,
        row,
        normalized,
        ownerId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo analizar la fila';
      planRows.push({
        rowNumber,
        businessName: csvRecord.businessName || csvRecord.ruc || `Fila ${rowNumber}`,
        ruc: csvRecord.ruc || '',
        outcome: 'ERROR',
        message,
      });
    }
  }

  const existingDuplicateLookup = await buildExistingDuplicateLookup(ctx.tenant.id, preparedRows);
  const seenRucs = new Set<string>();
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();

  for (const preparedRow of preparedRows) {
    const { rowNumber, row, normalized, ownerId } = preparedRow;

    if (normalized.rucNormalized && seenRucs.has(normalized.rucNormalized)) {
      planRows.push({
        rowNumber,
        businessName: row.businessName || row.ruc,
        ruc: row.ruc,
        outcome: 'SKIPPED',
        message: 'Duplicado dentro del mismo archivo por RUC',
      });
      continue;
    }

    if (normalized.emails.some((email) => seenEmails.has(email))) {
      planRows.push({
        rowNumber,
        businessName: row.businessName || row.ruc,
        ruc: row.ruc,
        outcome: 'SKIPPED',
        message: 'Duplicado dentro del mismo archivo por email',
      });
      continue;
    }

    if (normalized.phones.some((phone) => seenPhones.has(phone))) {
      planRows.push({
        rowNumber,
        businessName: row.businessName || row.ruc,
        ruc: row.ruc,
        outcome: 'SKIPPED',
        message: 'Duplicado dentro del mismo archivo por teléfono',
      });
      continue;
    }

    const existingDuplicateMessage = getExistingDuplicateMessage(
      normalized,
      existingDuplicateLookup,
    );
    if (existingDuplicateMessage) {
      planRows.push({
        rowNumber,
        businessName: row.businessName || row.ruc,
        ruc: row.ruc,
        outcome: 'SKIPPED',
        message: existingDuplicateMessage,
      });
      continue;
    }

    if (normalized.rucNormalized) seenRucs.add(normalized.rucNormalized);
    normalized.emails.forEach((email) => seenEmails.add(email));
    normalized.phones.forEach((phone) => seenPhones.add(phone));

    planRows.push({
      rowNumber,
      businessName: row.businessName || row.ruc,
      ruc: row.ruc,
      outcome: 'READY',
      message: ownerId ? 'Listo para importar con owner asignado' : 'Listo para importar',
      createData: buildImportCreateData(ctx.tenant.id, row, normalized, ownerId),
    });
  }

  return [...planRows].sort((left, right) => left.rowNumber - right.rowNumber);
}

async function getImportRequestPlan(input: unknown) {
  const parsed = importCsvSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud inválida', 400);
  }

  const ctx = await getTenantActionContextBySlug(parsed.data.tenantSlug);
  await assertImportEnabled(ctx.tenant.id);

  const actor = toLeadActorContext(ctx);
  if (!canImportLeads(actor)) {
    throw new AppError('No autorizado para importar leads', 403);
  }

  return {
    tenantSlug: ctx.tenant.slug,
    rows: await buildImportExecutionPlan(ctx, actor, parsed.data.csvText),
  };
}

export async function previewImportLeadsAction(input: unknown) {
  const { rows } = await getImportRequestPlan(input);

  return {
    success: true,
    readyCount: rows.filter((result) => result.outcome === 'READY').length,
    skippedCount: rows.filter((result) => result.outcome === 'SKIPPED').length,
    errorCount: rows.filter((result) => result.outcome === 'ERROR').length,
    results: rows.map((row) => ({
      rowNumber: row.rowNumber,
      businessName: row.businessName,
      ruc: row.ruc,
      outcome: row.outcome,
      message: row.message,
    })),
  };
}

export async function importLeadsAction(input: unknown) {
  const { tenantSlug, rows } = await getImportRequestPlan(input);
  const results: Array<
    Omit<ImportRowResult, 'outcome'> & { outcome: 'CREATED' | 'SKIPPED' | 'ERROR' }
  > = [];

  for (const row of rows) {
    if (row.outcome !== 'READY' || !row.createData) {
      results.push({
        rowNumber: row.rowNumber,
        businessName: row.businessName,
        ruc: row.ruc,
        outcome: row.outcome === 'READY' ? 'ERROR' : row.outcome,
        message: row.outcome === 'READY' ? 'La fila no pudo prepararse para importar' : row.message,
      });
      continue;
    }

    try {
      await db.lead.create({ data: row.createData });
      results.push({
        rowNumber: row.rowNumber,
        businessName: row.businessName,
        ruc: row.ruc,
        outcome: 'CREATED',
        message: 'Lead importado correctamente',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar la fila';
      results.push({
        rowNumber: row.rowNumber,
        businessName: row.businessName,
        ruc: row.ruc,
        outcome: 'ERROR',
        message,
      });
    }
  }

  const createdCount = results.filter((result) => result.outcome === 'CREATED').length;
  const skippedCount = results.filter((result) => result.outcome === 'SKIPPED').length;
  const errorCount = results.filter((result) => result.outcome === 'ERROR').length;

  if (createdCount > 0) {
    revalidateImportViews(tenantSlug);
  }

  return {
    success: true,
    createdCount,
    skippedCount,
    errorCount,
    results,
  };
}
