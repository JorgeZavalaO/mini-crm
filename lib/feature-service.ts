import { Prisma, type FeatureKey } from '@prisma/client';
import { db } from '@/lib/db';
import { FEATURE_KEYS } from '@/lib/feature-catalog';

export type TenantFeatureMap = Record<FeatureKey, boolean>;

function coreDefaultEnabled(featureKey: FeatureKey) {
  return (
    featureKey === 'DASHBOARD' ||
    featureKey === 'CRM_LEADS' ||
    featureKey === 'ASSIGNMENTS' ||
    featureKey === 'INTERACTIONS'
  );
}

function toFeatureMap(rows: Array<{ featureKey: FeatureKey; enabled: boolean }>): TenantFeatureMap {
  return FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = rows.find((row) => row.featureKey === key)?.enabled ?? false;
    return acc;
  }, {} as TenantFeatureMap);
}

export async function getTenantFeatureMap(tenantId: string): Promise<TenantFeatureMap> {
  await ensureTenantFeatureRows(tenantId);
  const rows = await db.tenantFeature.findMany({
    where: { tenantId },
    select: { featureKey: true, enabled: true },
  });
  return toFeatureMap(rows);
}

export async function isTenantFeatureEnabled(
  tenantId: string,
  featureKey: FeatureKey,
): Promise<boolean> {
  await ensureTenantFeatureRows(tenantId);
  const feature = await db.tenantFeature.findUnique({
    where: { tenantId_featureKey: { tenantId, featureKey } },
    select: { enabled: true },
  });
  return feature?.enabled ?? false;
}

export async function materializeTenantFeaturesFromPlan(
  tenantId: string,
  planId: string,
  overwrite: boolean,
) {
  const planFeatures = await db.planFeature.findMany({
    where: { planId },
    select: { featureKey: true, enabled: true, config: true },
  });

  const planMap = new Map(planFeatures.map((row) => [row.featureKey, row]));

  await db.$transaction(
    FEATURE_KEYS.map((featureKey) => {
      const fromPlan = planMap.get(featureKey);
      if (overwrite) {
        return db.tenantFeature.upsert({
          where: { tenantId_featureKey: { tenantId, featureKey } },
          update: {
            enabled: fromPlan?.enabled ?? false,
            config: fromPlan?.config ?? Prisma.JsonNull,
          },
          create: {
            tenantId,
            featureKey,
            enabled: fromPlan?.enabled ?? false,
            config: fromPlan?.config ?? Prisma.JsonNull,
          },
        });
      }

      return db.tenantFeature.upsert({
        where: { tenantId_featureKey: { tenantId, featureKey } },
        update: {},
        create: {
          tenantId,
          featureKey,
          enabled: fromPlan?.enabled ?? false,
          config: fromPlan?.config ?? Prisma.JsonNull,
        },
      });
    }),
  );
}

async function ensureTenantFeatureRows(tenantId: string) {
  const total = await db.tenantFeature.count({ where: { tenantId } });
  if (total > 0) return;

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { planId: true } });
  const planFeatures = tenant?.planId
    ? await db.planFeature.findMany({
        where: { planId: tenant.planId },
        select: { featureKey: true, enabled: true, config: true },
      })
    : [];
  const planMap = new Map(planFeatures.map((row) => [row.featureKey, row]));

  await db.$transaction(
    FEATURE_KEYS.map((featureKey) =>
      db.tenantFeature.upsert({
        where: { tenantId_featureKey: { tenantId, featureKey } },
        update: {},
        create: {
          tenantId,
          featureKey,
          enabled: planMap.get(featureKey)?.enabled ?? coreDefaultEnabled(featureKey),
          config: planMap.get(featureKey)?.config ?? Prisma.JsonNull,
        },
      }),
    ),
  );
}
