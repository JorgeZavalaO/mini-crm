CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "LeadContact" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "name" VARCHAR(200),
  "role" VARCHAR(120),
  "notes" VARCHAR(1000),
  "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LeadContact"
  ADD CONSTRAINT "LeadContact_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadContact"
  ADD CONSTRAINT "LeadContact_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "LeadContact_tenantId_leadId_idx" ON "LeadContact"("tenantId", "leadId");
CREATE INDEX "LeadContact_leadId_sortOrder_idx" ON "LeadContact"("leadId", "sortOrder");

INSERT INTO "LeadContact" (
  "id",
  "tenantId",
  "leadId",
  "name",
  "phones",
  "emails",
  "isPrimary",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::TEXT,
  "Lead"."tenantId",
  "Lead"."id",
  NULLIF(TRIM("Lead"."contactName"), ''),
  CASE
    WHEN NULLIF(TRIM("Lead"."contactPhone"), '') IS NULL THEN ARRAY[]::TEXT[]
    ELSE ARRAY[TRIM("Lead"."contactPhone")]
  END,
  ARRAY[]::TEXT[],
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Lead"
WHERE "Lead"."deletedAt" IS NULL
  AND (
    NULLIF(TRIM("Lead"."contactName"), '') IS NOT NULL
    OR NULLIF(TRIM("Lead"."contactPhone"), '') IS NOT NULL
  );
