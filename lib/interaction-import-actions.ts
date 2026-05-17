'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { assertTenantFeatureById, getTenantActionContextBySlug } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import {
  mapCsvRecordToInteractionImportRow,
  parseInteractionImportCsvRecords,
  expandMultipleInteractionsRow,
} from '@/lib/interaction-import-utils';
import { canImportLeads } from '@/lib/lead-permissions';
import { normalizeRuc } from '@/lib/lead-normalization';
import { importInteractionRowSchema, importInteractionsCsvSchema } from '@/lib/validators';

const MAX_IMPORT_ROWS = 2000;

type InteractionImportOutcome = 'READY' | 'CREATED' | 'SKIPPED' | 'ERROR';

type InteractionImportRowResult = {
  rowNumber: number;
  ruc: string;
  businessName: string;
  authorEmail: string;
  type: string;
  occurredAt: string;
  outcome: InteractionImportOutcome;
  message: string;
};

type InteractionActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

type ImportInteractionRow = ReturnType<typeof importInteractionRowSchema.parse>;

type PreparedInteractionImportRow = {
  rowNumber: number;
  row: ImportInteractionRow;
  rucNormalized: string;
};

type InteractionImportExecutionPlanRow = InteractionImportRowResult & {
  createData?: Prisma.InteractionCreateManyInput;
  leadId?: string;
};

function toInteractionActorContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
): InteractionActorContext {
  return {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

async function assertInteractionImportEnabled(tenantId: string) {
  try {
    await assertTenantFeatureById(tenantId, 'CRM_LEADS');
    await assertTenantFeatureById(tenantId, 'IMPORT');
    await assertTenantFeatureById(tenantId, 'INTERACTIONS');
  } catch {
    throw new AppError('La importacion de interacciones esta deshabilitada para este tenant', 403);
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function getCsvRecords(csvText: string) {
  const csvRecords = parseInteractionImportCsvRecords(csvText);

  if (csvRecords.length > MAX_IMPORT_ROWS) {
    throw new AppError(
      `El archivo supera el limite de ${MAX_IMPORT_ROWS} filas por importacion`,
      400,
    );
  }

  return csvRecords;
}

async function getLeadLookup(tenantId: string, rucs: string[]) {
  if (rucs.length === 0) return new Map<string, Array<{ id: string; businessName: string }>>();

  const leads = await db.lead.findMany({
    where: {
      tenantId,
      deletedAt: null,
      rucNormalized: { in: rucs },
    },
    select: {
      id: true,
      businessName: true,
      rucNormalized: true,
    },
  });
  const lookup = new Map<string, Array<{ id: string; businessName: string }>>();

  for (const lead of leads) {
    if (!lead.rucNormalized) continue;
    const entries = lookup.get(lead.rucNormalized) ?? [];
    entries.push({ id: lead.id, businessName: lead.businessName });
    lookup.set(lead.rucNormalized, entries);
  }

  return lookup;
}

async function getAuthorLookup(tenantId: string, emails: string[]) {
  if (emails.length === 0) return new Map<string, { id: string; email: string }>();

  const memberships = await db.membership.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    select: {
      user: { select: { id: true, email: true } },
    },
  });

  const requestedEmails = new Set(emails.map((email) => email.toLowerCase()));

  return new Map(
    memberships
      .filter((membership) => requestedEmails.has(membership.user.email.toLowerCase()))
      .map((membership) => [
        membership.user.email.toLowerCase(),
        { id: membership.user.id, email: membership.user.email },
      ]),
  );
}

async function buildInteractionImportExecutionPlan(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
  csvText: string,
): Promise<InteractionImportExecutionPlanRow[]> {
  const csvRecords = getCsvRecords(csvText);
  const preparedRows: PreparedInteractionImportRow[] = [];
  const planRows: InteractionImportExecutionPlanRow[] = [];

  for (const [index, csvRecord] of csvRecords.entries()) {
    const rowNumber = index + 2;

    try {
      const expandedRows = expandMultipleInteractionsRow(csvRecord, ctx.tenant.companyTimezone);

      // Validate all expanded rows
      const validatedRows = expandedRows.map((expandedRow) =>
        importInteractionRowSchema.parse(expandedRow),
      );

      // If all are valid, add them all to preparedRows
      for (const validatedRow of validatedRows) {
        const rucNormalized = normalizeRuc(validatedRow.ruc);

        if (!rucNormalized) {
          throw new AppError('El RUC debe contener al menos un caracter valido', 400);
        }

        preparedRows.push({
          rowNumber,
          row: validatedRow,
          rucNormalized,
        });
      }
    } catch (error) {
      // If any expanded row fails validation or expansion fails, reject the entire line
      planRows.push({
        rowNumber,
        ruc: csvRecord.ruc || '',
        businessName: csvRecord.ruc || `Fila ${rowNumber}`,
        authorEmail: csvRecord.authorEmail || csvRecord['authorEmail'] || '',
        type: csvRecord.type || csvRecord.types || '',
        occurredAt: csvRecord.occurredAt || '',
        outcome: 'ERROR',
        message: getErrorMessage(error, 'No se pudo analizar la fila'),
      });
    }
  }

  const leadLookup = await getLeadLookup(
    ctx.tenant.id,
    Array.from(new Set(preparedRows.map((entry) => entry.rucNormalized))),
  );
  const authorLookup = await getAuthorLookup(
    ctx.tenant.id,
    Array.from(new Set(preparedRows.map((entry) => entry.row.authorEmail))),
  );

  for (const preparedRow of preparedRows) {
    const { rowNumber, row, rucNormalized } = preparedRow;
    const matchedLeads = leadLookup.get(rucNormalized) ?? [];
    const author = authorLookup.get(row.authorEmail);

    if (matchedLeads.length === 0) {
      planRows.push({
        rowNumber,
        ruc: row.ruc,
        businessName: row.ruc,
        authorEmail: row.authorEmail,
        type: row.type,
        occurredAt: row.occurredAt.toISOString(),
        outcome: 'SKIPPED',
        message: 'No existe un lead activo con ese RUC',
      });
      continue;
    }

    if (matchedLeads.length > 1) {
      planRows.push({
        rowNumber,
        ruc: row.ruc,
        businessName: row.ruc,
        authorEmail: row.authorEmail,
        type: row.type,
        occurredAt: row.occurredAt.toISOString(),
        outcome: 'ERROR',
        message: 'RUC ambiguo: existe mas de un lead activo con ese RUC',
      });
      continue;
    }

    if (!author) {
      planRows.push({
        rowNumber,
        ruc: row.ruc,
        businessName: matchedLeads[0].businessName,
        authorEmail: row.authorEmail,
        type: row.type,
        occurredAt: row.occurredAt.toISOString(),
        outcome: 'ERROR',
        message: `No existe un miembro activo con email ${row.authorEmail}`,
      });
      continue;
    }

    const lead = matchedLeads[0];

    planRows.push({
      rowNumber,
      ruc: row.ruc,
      businessName: lead.businessName,
      authorEmail: row.authorEmail,
      type: row.type,
      occurredAt: row.occurredAt.toISOString(),
      outcome: 'READY',
      message: 'Listo para importar',
      leadId: lead.id,
      createData: {
        leadId: lead.id,
        tenantId: ctx.tenant.id,
        authorId: author.id,
        type: row.type,
        subject: row.subject ?? null,
        notes: row.notes,
        occurredAt: row.occurredAt,
      },
    });
  }

  return [...planRows].sort((left, right) => left.rowNumber - right.rowNumber);
}

async function getInteractionImportRequestPlan(input: unknown) {
  const parsed = importInteractionsCsvSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud invalida', 400);
  }

  const ctx = await getTenantActionContextBySlug(parsed.data.tenantSlug);
  await assertInteractionImportEnabled(ctx.tenant.id);

  const actor = toInteractionActorContext(ctx);
  if (!canImportLeads(actor)) {
    throw new AppError('No autorizado para importar interacciones', 403);
  }

  return {
    tenantSlug: ctx.tenant.slug,
    rows: await buildInteractionImportExecutionPlan(ctx, parsed.data.csvText),
  };
}

export async function previewImportInteractionsAction(input: unknown) {
  const { rows } = await getInteractionImportRequestPlan(input);

  return {
    success: true,
    readyCount: rows.filter((result) => result.outcome === 'READY').length,
    skippedCount: rows.filter((result) => result.outcome === 'SKIPPED').length,
    errorCount: rows.filter((result) => result.outcome === 'ERROR').length,
    results: rows.map((row) => ({
      rowNumber: row.rowNumber,
      ruc: row.ruc,
      businessName: row.businessName,
      authorEmail: row.authorEmail,
      type: row.type,
      occurredAt: row.occurredAt,
      outcome: row.outcome,
      message: row.message,
    })),
  };
}

export async function importInteractionsAction(input: unknown) {
  const { tenantSlug, rows } = await getInteractionImportRequestPlan(input);
  const readyRows = rows.filter(
    (
      row,
    ): row is typeof row & {
      createData: Prisma.InteractionCreateManyInput;
      leadId: string;
    } => row.outcome === 'READY' && row.createData !== undefined && row.leadId !== undefined,
  );
  const skippedRows = rows.filter((row) => row.outcome !== 'READY');
  const results: Array<
    Omit<InteractionImportRowResult, 'outcome'> & { outcome: InteractionImportOutcome }
  > = [];

  if (readyRows.length > 0) {
    await db.interaction.createMany({
      data: readyRows.map((row) => row.createData),
    });
  }

  for (const row of readyRows) {
    results.push({
      rowNumber: row.rowNumber,
      ruc: row.ruc,
      businessName: row.businessName,
      authorEmail: row.authorEmail,
      type: row.type,
      occurredAt: row.occurredAt,
      outcome: 'CREATED',
      message: 'Interaccion importada correctamente',
    });
  }

  for (const row of skippedRows) {
    results.push({
      rowNumber: row.rowNumber,
      ruc: row.ruc,
      businessName: row.businessName,
      authorEmail: row.authorEmail,
      type: row.type,
      occurredAt: row.occurredAt,
      outcome: row.outcome,
      message: row.message,
    });
  }

  results.sort((a, b) => a.rowNumber - b.rowNumber);

  const createdCount = readyRows.length;
  const skippedCount = results.filter((result) => result.outcome === 'SKIPPED').length;
  const errorCount = results.filter((result) => result.outcome === 'ERROR').length;

  if (createdCount > 0) {
    revalidatePath(`/${tenantSlug}/leads`);
    revalidatePath(`/${tenantSlug}/leads/interactions/import`);
    for (const leadId of Array.from(new Set(readyRows.map((row) => row.leadId)))) {
      revalidatePath(`/${tenantSlug}/leads/${leadId}`);
    }
  }

  return {
    success: true,
    createdCount,
    skippedCount,
    errorCount,
    results,
  };
}
