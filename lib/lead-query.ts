import type { Prisma } from '@prisma/client';
import { normalizeLeadName, normalizeRuc } from '@/lib/lead-normalization';
import type { leadFiltersSchema } from '@/lib/validators';
import type { z } from 'zod';

export type LeadFilters = z.infer<typeof leadFiltersSchema>;

function toNumericRange(min?: number, max?: number) {
  if (min === undefined && max === undefined) return undefined;
  return {
    ...(min !== undefined ? { gte: min } : {}),
    ...(max !== undefined ? { lte: max } : {}),
  };
}

export function buildLeadWhereClause(
  tenantId: string,
  filters: Omit<LeadFilters, 'page' | 'pageSize'>,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    tenantId,
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.ownerId === '__UNASSIGNED__'
      ? { ownerId: null }
      : filters.ownerId
        ? { ownerId: filters.ownerId }
        : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.province ? { province: filters.province } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.district ? { district: filters.district } : {}),
    ...(toNumericRange(filters.constitutionYearMin, filters.constitutionYearMax)
      ? {
          constitutionYear: toNumericRange(
            filters.constitutionYearMin,
            filters.constitutionYearMax,
          ),
        }
      : {}),
    ...(toNumericRange(filters.employeeCountMin, filters.employeeCountMax)
      ? { employeeCount: toNumericRange(filters.employeeCountMin, filters.employeeCountMax) }
      : {}),
    ...(toNumericRange(filters.importOperationCountMin, filters.importOperationCountMax)
      ? {
          importOperationCount: toNumericRange(
            filters.importOperationCountMin,
            filters.importOperationCountMax,
          ),
        }
      : {}),
    ...(toNumericRange(filters.exportOperationCountMin, filters.exportOperationCountMax)
      ? {
          exportOperationCount: toNumericRange(
            filters.exportOperationCountMin,
            filters.exportOperationCountMax,
          ),
        }
      : {}),
  };

  const q = filters.q?.trim();
  if (q) {
    const normalizedName = normalizeLeadName(q);
    const normalizedRuc = normalizeRuc(q);
    where.OR = [
      { businessName: { contains: q, mode: 'insensitive' } },
      { nameNormalized: { contains: normalizedName } },
      ...(normalizedRuc ? [{ rucNormalized: { contains: normalizedRuc } }] : []),
      { emails: { has: q.toLowerCase() } },
      { phones: { has: q } },
    ];
  }

  return where;
}

/**
 * Parses URLSearchParams (from useSearchParams() on the client side)
 * into a plain object ready to validate with leadFiltersSchema.
 */
export function parseLeadFiltersFromSearchParams(
  params: URLSearchParams | { get(key: string): string | null },
): Record<string, string | undefined> {
  const keys = [
    'q',
    'status',
    'ownerId',
    'country',
    'province',
    'source',
    'city',
    'district',
    'constitutionYearMin',
    'constitutionYearMax',
    'employeeCountMin',
    'employeeCountMax',
    'importOperationCountMin',
    'importOperationCountMax',
    'exportOperationCountMin',
    'exportOperationCountMax',
    'page',
    'pageSize',
  ] as const;

  return Object.fromEntries(keys.map((key) => [key, params.get(key) ?? undefined]));
}
