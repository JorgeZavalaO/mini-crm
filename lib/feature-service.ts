import { Prisma, type FeatureKey } from '@prisma/client';
import { db } from '@/lib/db';
import {
  CORE_DEFAULT_FEATURE_KEYS,
  FEATURE_KEYS,
  PLAN_FEATURE_BUNDLES,
} from '@/lib/feature-catalog';

export type TenantFeatureMap = Record<FeatureKey, boolean>;

function coreDefaultEnabled(featureKey: FeatureKey) {
  return CORE_DEFAULT_FEATURE_KEYS.includes(featureKey);
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
  // Verifica por clave faltante (no por total) — maneja features nuevas en tenants existentes
  const existing = await db.tenantFeature.findMany({
    where: { tenantId },
    select: { featureKey: true },
  });
  const existingKeys = new Set(existing.map((r) => r.featureKey));
  const missingKeys = FEATURE_KEYS.filter((k) => !existingKeys.has(k));
  if (missingKeys.length === 0) return;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { planId: true, plan: { select: { name: true } } },
  });

  const planFeatures = tenant?.planId
    ? await db.planFeature.findMany({
        where: { planId: tenant.planId },
        select: { featureKey: true, enabled: true, config: true },
      })
    : [];
  const planMap = new Map(planFeatures.map((row) => [row.featureKey, row]));

  // Fallback: usa PLAN_FEATURE_BUNDLES en memoria cuando PlanFeature en BD está desactualizado
  const planNameToKey: Record<string, 'STARTER' | 'GROWTH' | 'SCALE'> = {
    Starter: 'STARTER',
    Growth: 'GROWTH',
    Scale: 'SCALE',
  };
  const bundleKey = tenant?.plan?.name ? planNameToKey[tenant.plan.name] : undefined;
  const bundle = bundleKey ? PLAN_FEATURE_BUNDLES[bundleKey] : undefined;

  await db.$transaction(
    missingKeys.map((featureKey) => {
      const fromPlan = planMap.get(featureKey);
      const enabled =
        fromPlan?.enabled ?? bundle?.[featureKey]?.enabled ?? coreDefaultEnabled(featureKey);
      return db.tenantFeature.upsert({
        where: { tenantId_featureKey: { tenantId, featureKey } },
        update: {},
        create: {
          tenantId,
          featureKey,
          enabled,
          config: fromPlan?.config ?? Prisma.JsonNull,
        },
      });
    }),
  );
}
