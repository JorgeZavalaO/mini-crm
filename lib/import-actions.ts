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
import {
  buildLeadContactCreateManyData,
  getLegacyContactFields,
  normalizeLeadContacts,
  type LeadContactInput,
  type NormalizedLeadContactInput,
} from '@/lib/lead-contacts';
import { importCsvSchema, importLeadRowSchema, importLeadUpdateRowSchema } from '@/lib/validators';

const MAX_IMPORT_ROWS = 2000;

type ImportMode = 'CREATE' | 'UPDATE_BY_RUC';

type LeadActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

type ImportOutcome = 'READY' | 'CREATED' | 'UPDATED' | 'SKIPPED' | 'ERROR';

type ImportRowResult = {
  rowNumber: number;
  businessName: string;
  ruc: string;
  outcome: ImportOutcome;
  message: string;
};

type ImportLeadCreateRow = ReturnType<typeof importLeadRowSchema.parse>;
type ImportLeadUpdateRow = ReturnType<typeof importLeadUpdateRowSchema.parse>;

type NormalizedImportRow = {
  rucNormalized: string | null;
  nameNormalized: string | null;
  emails: string[];
  phones: string[];
};

type PreparedImportRow<TImportRow> = {
  rowNumber: number;
  row: TImportRow;
  normalized: NormalizedImportRow;
  ownerId: string | null;
  ownerRequested: boolean;
};

type ImportExecutionPlanRow = ImportRowResult & {
  createData?: Prisma.LeadUncheckedCreateInput;
  updateData?: Prisma.LeadUncheckedUpdateInput;
  contacts?: NormalizedLeadContactInput[];
  replaceContacts?: boolean;
  leadId?: string;
  previousOwnerId?: string | null;
  newOwnerId?: string | null;
  ownerChanged?: boolean;
};

type ExistingDuplicateLookup = {
  byRuc: Map<string, string>;
  byEmail: Map<string, string>;
  byPhone: Map<string, string>;
};

type ExistingLeadForUpdate = {
  id: string;
  businessName: string;
  ruc: string | null;
  rucNormalized: string | null;
  ownerId: string | null;
  contacts: Array<{
    name: string | null;
    phones: string[];
    emails: string[];
    role: string | null;
    notes: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
};

type OwnerImportContext = {
  canAssign: boolean;
  assignableOwnerMap: Map<string, string>;
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
    throw new AppError('La importacion esta deshabilitada para este tenant', 403);
  }
}

function revalidateImportViews(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/dashboard`);
  revalidatePath(`/${tenantSlug}/leads`);
  revalidatePath(`/${tenantSlug}/leads/import`);
  revalidatePath(`/${tenantSlug}/leads/dedupe`);
}

async function getOwnerImportContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
  actor: LeadActorContext,
): Promise<OwnerImportContext> {
  const assignmentsEnabled = await isTenantFeatureEnabled(ctx.tenant.id, 'ASSIGNMENTS');
  const canAssign = assignmentsEnabled && canAssignLeads(actor);

  const ownerMemberships = await db.membership.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    select: {
      role: true,
      user: { select: { id: true, email: true } },
    },
  });

  return {
    canAssign,
    assignableOwnerMap: new Map(
      ownerMemberships
        .filter((membership) => canOwnLeads(membership.role))
        .map((membership) => [membership.user.email.toLowerCase(), membership.user.id]),
    ),
  };
}

function resolveOwnerId(ownerEmail: string | undefined, ownerContext: OwnerImportContext) {
  if (!ownerEmail) return null;

  if (!ownerContext.canAssign) {
    throw new AppError('No tienes permisos para asignar owners durante la importacion', 403);
  }

  const ownerId = ownerContext.assignableOwnerMap.get(ownerEmail) ?? null;
  if (!ownerId) {
    throw new AppError(`No existe un owner elegible con email ${ownerEmail}`, 400);
  }

  return ownerId;
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
  rows: Array<{ normalized: NormalizedImportRow }>,
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
    return `Coincide con lead existente por telefono (${duplicatedPhone}): ${lookup.byPhone.get(duplicatedPhone)}`;
  }

  return null;
}

function normalizeImportRow(
  row: Pick<ImportLeadCreateRow, 'ruc' | 'businessName' | 'emails' | 'phones'>,
) {
  const businessName = row.businessName?.trim();

  return {
    rucNormalized: normalizeRuc(row.ruc),
    nameNormalized: businessName ? normalizeLeadName(businessName) : null,
    emails: normalizeEmails(row.emails),
    phones: normalizePhones(row.phones),
  } satisfies NormalizedImportRow;
}

function getImportContactMutationData(
  row: {
    contacts?: LeadContactInput[];
    contactName?: string;
    contactPhone?: string;
    hasContactColumns?: boolean;
  },
  existingContacts: ExistingLeadForUpdate['contacts'] = [],
) {
  const legacyContact =
    row.contactName || row.contactPhone
      ? [
          {
            name: row.contactName,
            phones: row.contactPhone ? [row.contactPhone] : [],
            isPrimary: true,
          },
        ]
      : [];
  const importedContacts = normalizeLeadContacts(
    row.contacts && row.contacts.length > 0 ? row.contacts : legacyContact,
  );
  const replaceContacts = Boolean(row.hasContactColumns && importedContacts.length > 0);
  const sortedExistingContacts = [...existingContacts].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const contacts = replaceContacts
    ? importedContacts.map((contact, index) => {
        const existingContact = sortedExistingContacts[index];

        return {
          ...contact,
          name: contact.name ?? existingContact?.name ?? null,
          phones:
            contact.phones.length > 0
              ? contact.phones
              : normalizePhones(existingContact?.phones ?? []),
          emails:
            contact.emails.length > 0
              ? contact.emails
              : normalizeEmails(existingContact?.emails ?? []),
          role: contact.role ?? existingContact?.role ?? null,
          notes: contact.notes ?? existingContact?.notes ?? null,
        };
      })
    : importedContacts;
  const legacyFields =
    contacts.length > 0
      ? getLegacyContactFields(contacts)
      : {
          contactName: row.contactName ?? null,
          contactPhone: row.contactPhone ?? null,
        };

  return {
    contacts,
    legacyFields,
    replaceContacts,
  };
}

function buildImportCreateData(
  tenantId: string,
  row: ImportLeadCreateRow,
  normalized: NormalizedImportRow,
  ownerId: string | null,
  importedById: string,
): Prisma.LeadUncheckedCreateInput {
  const businessName = (row.businessName?.trim() || row.ruc).trim();
  const contactMutation = getImportContactMutationData(row);

  return {
    businessName,
    ruc: row.ruc.trim(),
    rucNormalized: normalized.rucNormalized,
    nameNormalized: normalized.nameNormalized ?? normalizeLeadName(businessName),
    country: row.country ?? null,
    city: row.city ?? null,
    industry: row.industry ?? null,
    source: row.source ?? null,
    gerente: row.gerente ?? null,
    contactName: contactMutation.legacyFields.contactName,
    contactPhone: contactMutation.legacyFields.contactPhone,
    notes: row.notes ?? null,
    phones: normalized.phones,
    emails: normalized.emails,
    status: row.status,
    ownerId,
    tenantId,
    importedById,
    importedAt: new Date(),
  };
}

function buildImportUpdateData(
  row: ImportLeadUpdateRow,
  normalized: NormalizedImportRow,
  existingLead: ExistingLeadForUpdate,
  ownerId: string | null,
  ownerRequested: boolean,
  importedById: string,
  contactMutation = getImportContactMutationData(row, existingLead.contacts),
): Prisma.LeadUncheckedUpdateInput | null {
  const data: Prisma.LeadUncheckedUpdateInput = {};
  let hasUpdate = false;

  if (row.businessName) {
    const businessName = row.businessName.trim();
    data.businessName = businessName;
    data.nameNormalized = normalized.nameNormalized ?? normalizeLeadName(businessName);
    hasUpdate = true;
  }

  if (row.country !== undefined) {
    data.country = row.country;
    hasUpdate = true;
  }

  if (row.city !== undefined) {
    data.city = row.city;
    hasUpdate = true;
  }

  if (row.industry !== undefined) {
    data.industry = row.industry;
    hasUpdate = true;
  }

  if (row.source !== undefined) {
    data.source = row.source;
    hasUpdate = true;
  }

  if (row.gerente !== undefined) {
    data.gerente = row.gerente;
    hasUpdate = true;
  }

  if (contactMutation.replaceContacts) {
    data.contactName = contactMutation.legacyFields.contactName;
    data.contactPhone = contactMutation.legacyFields.contactPhone;
    hasUpdate = true;
  } else {
    if (row.contactName !== undefined) {
      data.contactName = row.contactName;
      hasUpdate = true;
    }

    if (row.contactPhone !== undefined) {
      data.contactPhone = row.contactPhone;
      hasUpdate = true;
    }
  }

  if (row.notes !== undefined) {
    data.notes = row.notes;
    hasUpdate = true;
  }

  if (normalized.phones.length > 0) {
    data.phones = normalized.phones;
    hasUpdate = true;
  }

  if (normalized.emails.length > 0) {
    data.emails = normalized.emails;
    hasUpdate = true;
  }

  if (row.status !== undefined) {
    data.status = row.status;
    hasUpdate = true;
  }

  if (ownerRequested && ownerId !== existingLead.ownerId) {
    data.ownerId = ownerId;
    hasUpdate = true;
  }

  if (!hasUpdate) return null;

  data.importedById = importedById;
  data.importedAt = new Date();

  return data;
}

function getCsvRecords(csvText: string) {
  const csvRecords = parseImportCsvRecords(csvText);

  if (csvRecords.length > MAX_IMPORT_ROWS) {
    throw new AppError(
      `El archivo supera el limite de ${MAX_IMPORT_ROWS} filas por importacion`,
      400,
    );
  }

  return csvRecords;
}

async function buildCreateImportExecutionPlan(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
  actor: LeadActorContext,
  csvText: string,
): Promise<ImportExecutionPlanRow[]> {
  const ownerContext = await getOwnerImportContext(ctx, actor);
  const csvRecords = getCsvRecords(csvText);
  const preparedRows: Array<PreparedImportRow<ImportLeadCreateRow>> = [];
  const planRows: ImportExecutionPlanRow[] = [];

  for (const [index, csvRecord] of csvRecords.entries()) {
    const rowNumber = index + 2;

    try {
      const row = importLeadRowSchema.parse(
        mapCsvRecordToImportRow(csvRecord, { defaultStatus: true }),
      );
      const normalized = normalizeImportRow(row);
      const ownerId = resolveOwnerId(row.ownerEmail, ownerContext);

      preparedRows.push({
        rowNumber,
        row,
        normalized,
        ownerId,
        ownerRequested: Boolean(row.ownerEmail),
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
        message: 'Duplicado dentro del mismo archivo por telefono',
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
      createData: buildImportCreateData(ctx.tenant.id, row, normalized, ownerId, actor.userId),
      contacts: getImportContactMutationData(row).contacts,
    });
  }

  return [...planRows].sort((left, right) => left.rowNumber - right.rowNumber);
}

async function buildExistingLeadUpdateLookup(
  tenantId: string,
  rows: Array<PreparedImportRow<ImportLeadUpdateRow>>,
) {
  const rucs = Array.from(
    new Set(
      rows
        .map((entry) => entry.normalized.rucNormalized)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (rucs.length === 0) return new Map<string, ExistingLeadForUpdate>();

  const existingLeads = await db.lead.findMany({
    where: {
      tenantId,
      deletedAt: null,
      rucNormalized: { in: rucs },
    },
    select: {
      id: true,
      businessName: true,
      ruc: true,
      rucNormalized: true,
      ownerId: true,
      contacts: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          name: true,
          phones: true,
          emails: true,
          role: true,
          notes: true,
          isPrimary: true,
          sortOrder: true,
        },
      },
    },
  });

  return new Map(
    existingLeads
      .filter((lead) => Boolean(lead.rucNormalized))
      .map((lead) => [lead.rucNormalized as string, lead]),
  );
}

async function buildUpdateImportExecutionPlan(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
  actor: LeadActorContext,
  csvText: string,
): Promise<ImportExecutionPlanRow[]> {
  const ownerContext = await getOwnerImportContext(ctx, actor);
  const csvRecords = getCsvRecords(csvText);
  const preparedRows: Array<PreparedImportRow<ImportLeadUpdateRow>> = [];
  const planRows: ImportExecutionPlanRow[] = [];

  for (const [index, csvRecord] of csvRecords.entries()) {
    const rowNumber = index + 2;

    try {
      const row = importLeadUpdateRowSchema.parse(
        mapCsvRecordToImportRow(csvRecord, { defaultStatus: false }),
      );
      const normalized = normalizeImportRow(row);

      if (!normalized.rucNormalized) {
        throw new AppError('El RUC debe contener al menos un caracter valido', 400);
      }

      const ownerId = resolveOwnerId(row.ownerEmail, ownerContext);

      preparedRows.push({
        rowNumber,
        row,
        normalized,
        ownerId,
        ownerRequested: Boolean(row.ownerEmail),
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

  const existingLeadLookup = await buildExistingLeadUpdateLookup(ctx.tenant.id, preparedRows);
  const seenRucs = new Set<string>();

  for (const preparedRow of preparedRows) {
    const { rowNumber, row, normalized, ownerId, ownerRequested } = preparedRow;
    const rucKey = normalized.rucNormalized;

    if (!rucKey) {
      planRows.push({
        rowNumber,
        businessName: row.businessName || row.ruc,
        ruc: row.ruc,
        outcome: 'ERROR',
        message: 'El RUC debe contener al menos un caracter valido',
      });
      continue;
    }

    if (seenRucs.has(rucKey)) {
      planRows.push({
        rowNumber,
        businessName: row.businessName || row.ruc,
        ruc: row.ruc,
        outcome: 'SKIPPED',
        message: 'Duplicado dentro del mismo archivo por RUC',
      });
      continue;
    }
    seenRucs.add(rucKey);

    const existingLead = existingLeadLookup.get(rucKey);
    if (!existingLead) {
      planRows.push({
        rowNumber,
        businessName: row.businessName || row.ruc,
        ruc: row.ruc,
        outcome: 'SKIPPED',
        message: 'No existe un lead activo con ese RUC',
      });
      continue;
    }

    const contactMutation = getImportContactMutationData(row, existingLead.contacts);
    const updateData = buildImportUpdateData(
      row,
      normalized,
      existingLead,
      ownerId,
      ownerRequested,
      actor.userId,
      contactMutation,
    );

    if (!updateData) {
      planRows.push({
        rowNumber,
        businessName: existingLead.businessName,
        ruc: existingLead.ruc || row.ruc,
        outcome: 'SKIPPED',
        message: 'No hay campos para actualizar',
      });
      continue;
    }

    const ownerChanged = ownerRequested && ownerId !== existingLead.ownerId;

    planRows.push({
      rowNumber,
      businessName: row.businessName || existingLead.businessName,
      ruc: existingLead.ruc || row.ruc,
      outcome: 'READY',
      message: ownerChanged ? 'Listo para actualizar y reasignar owner' : 'Listo para actualizar',
      updateData,
      contacts: contactMutation.contacts,
      replaceContacts: contactMutation.replaceContacts,
      leadId: existingLead.id,
      previousOwnerId: existingLead.ownerId,
      newOwnerId: ownerRequested ? ownerId : existingLead.ownerId,
      ownerChanged,
    });
  }

  return [...planRows].sort((left, right) => left.rowNumber - right.rowNumber);
}

async function buildImportExecutionPlan(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
  actor: LeadActorContext,
  csvText: string,
  mode: ImportMode,
): Promise<ImportExecutionPlanRow[]> {
  if (mode === 'UPDATE_BY_RUC') {
    return buildUpdateImportExecutionPlan(ctx, actor, csvText);
  }

  return buildCreateImportExecutionPlan(ctx, actor, csvText);
}

async function getImportRequestPlan(input: unknown) {
  const parsed = importCsvSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Solicitud invalida', 400);
  }

  const ctx = await getTenantActionContextBySlug(parsed.data.tenantSlug);
  await assertImportEnabled(ctx.tenant.id);

  const actor = toLeadActorContext(ctx);
  if (!canImportLeads(actor)) {
    throw new AppError('No autorizado para importar leads', 403);
  }

  return {
    mode: parsed.data.mode,
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    importedById: actor.userId,
    rows: await buildImportExecutionPlan(ctx, actor, parsed.data.csvText, parsed.data.mode),
  };
}

export async function previewImportLeadsAction(input: unknown) {
  const { mode, rows } = await getImportRequestPlan(input);

  return {
    success: true,
    mode,
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
  const { mode, tenantId, tenantSlug, importedById, rows } = await getImportRequestPlan(input);

  const readyCreateRows = rows.filter(
    (
      row,
    ): row is typeof row & {
      createData: Prisma.LeadUncheckedCreateInput;
      contacts?: NormalizedLeadContactInput[];
    } => row.outcome === 'READY' && row.createData !== undefined,
  );
  const readyUpdateRows = rows.filter(
    (
      row,
    ): row is typeof row & {
      updateData: Prisma.LeadUncheckedUpdateInput;
      contacts?: NormalizedLeadContactInput[];
      replaceContacts?: boolean;
      leadId: string;
    } => row.outcome === 'READY' && row.updateData !== undefined && row.leadId !== undefined,
  );
  const skippedRows = rows.filter((row) => row.outcome !== 'READY');

  const results: Array<
    Omit<ImportRowResult, 'outcome'> & { outcome: 'CREATED' | 'UPDATED' | 'SKIPPED' | 'ERROR' }
  > = [];

  if (readyCreateRows.length > 0) {
    await db.$transaction(async (tx) => {
      for (const row of readyCreateRows) {
        const lead = await tx.lead.create({
          data: row.createData,
          select: { id: true },
        });

        if (row.contacts && row.contacts.length > 0) {
          await tx.leadContact.createMany({
            data: buildLeadContactCreateManyData(tenantId, lead.id, row.contacts),
          });
        }
      }
    });
  }

  if (readyUpdateRows.length > 0) {
    await db.$transaction(async (tx) => {
      for (const row of readyUpdateRows) {
        await tx.lead.update({
          where: { id: row.leadId, tenantId },
          data: row.updateData,
        });

        if (row.replaceContacts) {
          await tx.leadContact.deleteMany({
            where: { tenantId, leadId: row.leadId },
          });

          if (row.contacts && row.contacts.length > 0) {
            await tx.leadContact.createMany({
              data: buildLeadContactCreateManyData(tenantId, row.leadId, row.contacts),
            });
          }
        }

        if (row.ownerChanged) {
          await tx.leadOwnerHistory.create({
            data: {
              leadId: row.leadId,
              tenantId,
              previousOwnerId: row.previousOwnerId ?? null,
              newOwnerId: row.newOwnerId ?? null,
              changedById: importedById,
            },
          });
        }
      }
    });
  }

  for (const row of readyCreateRows) {
    results.push({
      rowNumber: row.rowNumber,
      businessName: row.businessName,
      ruc: row.ruc,
      outcome: 'CREATED',
      message: 'Lead importado correctamente',
    });
  }

  for (const row of readyUpdateRows) {
    results.push({
      rowNumber: row.rowNumber,
      businessName: row.businessName,
      ruc: row.ruc,
      outcome: 'UPDATED',
      message: 'Lead actualizado correctamente',
    });
  }

  for (const row of skippedRows) {
    results.push({
      rowNumber: row.rowNumber,
      businessName: row.businessName,
      ruc: row.ruc,
      outcome: row.outcome === 'READY' ? 'ERROR' : row.outcome,
      message: row.message,
    });
  }

  results.sort((a, b) => a.rowNumber - b.rowNumber);

  const createdCount = readyCreateRows.length;
  const updatedCount = readyUpdateRows.length;
  const skippedCount = results.filter((result) => result.outcome === 'SKIPPED').length;
  const errorCount = results.filter((result) => result.outcome === 'ERROR').length;

  if (createdCount > 0 || updatedCount > 0) {
    revalidateImportViews(tenantSlug);
  }

  return {
    success: true,
    mode,
    createdCount,
    updatedCount,
    skippedCount,
    errorCount,
    results,
  };
}
