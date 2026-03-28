import type { LeadStatus } from '@prisma/client';
import {
  normalizeEmails,
  normalizeLeadName,
  normalizePhones,
  normalizeRuc,
} from '@/lib/lead-normalization';

export type DuplicateCriterion = 'RUC' | 'EMAIL' | 'PHONE' | 'NAME';

export const DUPLICATE_CRITERION_LABEL: Record<DuplicateCriterion, string> = {
  RUC: 'RUC',
  EMAIL: 'Email',
  PHONE: 'Teléfono',
  NAME: 'Nombre',
};

export type DedupableLead = {
  id: string;
  businessName: string;
  ruc: string | null;
  rucNormalized: string | null;
  nameNormalized: string;
  country: string | null;
  city: string | null;
  industry: string | null;
  source: string | null;
  notes: string | null;
  phones: string[];
  emails: string[];
  status: LeadStatus;
  ownerId: string | null;
  owner?: { name: string | null; email: string } | null;
  updatedAt?: Date;
};

export type DuplicateLeadGroup = {
  id: string;
  criterion: DuplicateCriterion;
  matchValue: string;
  leads: DedupableLead[];
};

function sortLeads(leads: DedupableLead[]) {
  return [...leads].sort((left, right) => {
    if (left.updatedAt && right.updatedAt) {
      return left.updatedAt.getTime() - right.updatedAt.getTime();
    }
    return left.businessName.localeCompare(right.businessName);
  });
}

function getCriterionValues(lead: DedupableLead, criterion: DuplicateCriterion): string[] {
  if (criterion === 'RUC') {
    return lead.rucNormalized ? [lead.rucNormalized] : [];
  }

  if (criterion === 'EMAIL') {
    return normalizeEmails(lead.emails);
  }

  if (criterion === 'PHONE') {
    return normalizePhones(lead.phones);
  }

  const normalizedName = normalizeLeadName(lead.businessName);
  return normalizedName.length >= 6 ? [normalizedName] : [];
}

export function findDuplicateGroups(
  leads: DedupableLead[],
  criterion: DuplicateCriterion,
): DuplicateLeadGroup[] {
  const groups = new Map<string, DedupableLead[]>();

  for (const lead of leads) {
    const values = getCriterionValues(lead, criterion);

    for (const value of values) {
      const group = groups.get(value) ?? [];
      if (!group.some((entry) => entry.id === lead.id)) {
        group.push(lead);
      }
      groups.set(value, group);
    }
  }

  return Array.from(groups.entries())
    .filter(([, matchedLeads]) => matchedLeads.length > 1)
    .map(([matchValue, matchedLeads]) => ({
      id: `${criterion}:${matchValue}`,
      criterion,
      matchValue,
      leads: sortLeads(matchedLeads),
    }))
    .sort((left, right) => {
      if (right.leads.length !== left.leads.length) {
        return right.leads.length - left.leads.length;
      }
      return left.matchValue.localeCompare(right.matchValue);
    });
}

export function buildDuplicateGroupsByCriterion(leads: DedupableLead[]) {
  return {
    RUC: findDuplicateGroups(leads, 'RUC'),
    EMAIL: findDuplicateGroups(leads, 'EMAIL'),
    PHONE: findDuplicateGroups(leads, 'PHONE'),
    NAME: findDuplicateGroups(leads, 'NAME'),
  } as const;
}

export function summarizeDuplicateGroups(
  groupsByCriterion: ReturnType<typeof buildDuplicateGroupsByCriterion>,
) {
  const allGroups = Object.values(groupsByCriterion).flat();
  const uniqueLeadIds = new Set(allGroups.flatMap((group) => group.leads.map((lead) => lead.id)));

  return {
    totalGroups: allGroups.length,
    totalLeadsAtRisk: uniqueLeadIds.size,
    byCriterion: {
      RUC: groupsByCriterion.RUC.length,
      EMAIL: groupsByCriterion.EMAIL.length,
      PHONE: groupsByCriterion.PHONE.length,
      NAME: groupsByCriterion.NAME.length,
    },
  };
}

function pickFirstDefined<T>(values: Array<T | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined && value !== '') ?? null;
}

function mergeNotes(primary: DedupableLead, duplicates: DedupableLead[]) {
  const uniqueNotes = Array.from(
    new Set(
      [primary.notes?.trim(), ...duplicates.map((lead) => lead.notes?.trim())].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );

  const mergeSummary = `Fusión realizada con: ${duplicates.map((lead) => lead.businessName).join(', ')}`;

  if (uniqueNotes.length === 0) {
    return mergeSummary;
  }

  return `${uniqueNotes.join('\n\n---\n\n')}\n\n---\n\n${mergeSummary}`;
}

export function buildMergedLeadData(primary: DedupableLead, duplicates: DedupableLead[]) {
  const mergedRuc = pickFirstDefined([primary.ruc, ...duplicates.map((lead) => lead.ruc)]);

  return {
    businessName: primary.businessName,
    ruc: mergedRuc,
    rucNormalized: normalizeRuc(mergedRuc),
    nameNormalized: normalizeLeadName(primary.businessName),
    country: pickFirstDefined([primary.country, ...duplicates.map((lead) => lead.country)]),
    city: pickFirstDefined([primary.city, ...duplicates.map((lead) => lead.city)]),
    industry: pickFirstDefined([primary.industry, ...duplicates.map((lead) => lead.industry)]),
    source: pickFirstDefined([primary.source, ...duplicates.map((lead) => lead.source)]),
    notes: mergeNotes(primary, duplicates),
    phones: normalizePhones([primary.phones, ...duplicates.map((lead) => lead.phones)].flat()),
    emails: normalizeEmails([primary.emails, ...duplicates.map((lead) => lead.emails)].flat()),
    status: primary.status,
    ownerId: pickFirstDefined([primary.ownerId, ...duplicates.map((lead) => lead.ownerId)]),
  };
}
