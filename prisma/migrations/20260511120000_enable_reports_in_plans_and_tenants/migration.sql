-- Migration: Enable REPORTS feature for Growth/Scale plans and their tenants
-- Safe: uses ON CONFLICT to avoid duplicates and handle existing rows

-- 1. Add REPORTS to PlanFeature for Growth and Scale plans (upsert, always enabled)
INSERT INTO "PlanFeature" ("id", "planId", "featureKey", "enabled", "config", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  p.id,
  'REPORTS'::"FeatureKey",
  true,
  NULL,
  now(),
  now()
FROM "Plan" p
WHERE LOWER(p.name) IN ('growth', 'scale')
ON CONFLICT ("planId", "featureKey") DO UPDATE
  SET "enabled" = true,
      "updatedAt" = now();

-- 2. Enable REPORTS for existing tenants on Growth/Scale plans
--    (insert if missing, update to true if was incorrectly set to false)
INSERT INTO "TenantFeature" ("id", "tenantId", "featureKey", "enabled", "config", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  t.id,
  'REPORTS'::"FeatureKey",
  true,
  NULL,
  now(),
  now()
FROM "Tenant" t
JOIN "Plan" p ON t."planId" = p.id
WHERE LOWER(p.name) IN ('growth', 'scale')
  AND t."deletedAt" IS NULL
ON CONFLICT ("tenantId", "featureKey") DO UPDATE
  SET "enabled" = true,
      "updatedAt" = now();
