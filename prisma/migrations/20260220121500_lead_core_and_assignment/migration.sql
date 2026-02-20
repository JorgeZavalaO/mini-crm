-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "ReassignmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Prepare Lead ownership column rename
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_assignedToId_fkey";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Lead' AND column_name = 'assignedToId'
  ) THEN
    ALTER TABLE "Lead" RENAME COLUMN "assignedToId" TO "ownerId";
  END IF;
END $$;

-- Extend Lead fields
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "businessName" TEXT,
  ADD COLUMN IF NOT EXISTS "ruc" TEXT,
  ADD COLUMN IF NOT EXISTS "rucNormalized" TEXT,
  ADD COLUMN IF NOT EXISTS "nameNormalized" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "industry" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Backfill from legacy Lead columns
UPDATE "Lead"
SET
  "businessName" = COALESCE(NULLIF("businessName", ''), NULLIF("company", ''), NULLIF("name", ''), 'Sin nombre'),
  "nameNormalized" = COALESCE(
    NULLIF(
      regexp_replace(
        lower(trim(COALESCE(NULLIF("businessName", ''), NULLIF("company", ''), NULLIF("name", ''), 'Sin nombre'))),
        '\\s+',
        ' ',
        'g'
      ),
      ''
    ),
    'sin nombre'
  ),
  "phones" = CASE
    WHEN COALESCE("phone", '') <> '' THEN ARRAY["phone"]
    ELSE COALESCE("phones", ARRAY[]::TEXT[])
  END,
  "emails" = CASE
    WHEN COALESCE("email", '') <> '' THEN ARRAY[lower("email")]
    ELSE COALESCE("emails", ARRAY[]::TEXT[])
  END;

ALTER TABLE "Lead"
  ALTER COLUMN "businessName" SET NOT NULL,
  ALTER COLUMN "nameNormalized" SET NOT NULL,
  ALTER COLUMN "phones" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "phones" SET NOT NULL,
  ALTER COLUMN "emails" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "emails" SET NOT NULL;

ALTER TABLE "Lead"
  DROP COLUMN IF EXISTS "name",
  DROP COLUMN IF EXISTS "company",
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "phone";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Lead_ownerId_fkey'
  ) THEN
    ALTER TABLE "Lead"
      ADD CONSTRAINT "Lead_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Lead indexes
CREATE INDEX IF NOT EXISTS "Lead_tenantId_deletedAt_idx" ON "Lead"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_status_idx" ON "Lead"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_ownerId_idx" ON "Lead"("tenantId", "ownerId");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_source_idx" ON "Lead"("tenantId", "source");
CREATE INDEX IF NOT EXISTS "Lead_tenantId_city_idx" ON "Lead"("tenantId", "city");

-- Tenant-level dedupe for active leads by normalized RUC
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_tenantId_rucNormalized_active_key"
ON "Lead"("tenantId", "rucNormalized")
WHERE "deletedAt" IS NULL AND "rucNormalized" IS NOT NULL;

-- Reassignment requests workflow table
CREATE TABLE IF NOT EXISTS "LeadReassignmentRequest" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "requestedOwnerId" TEXT,
  "reason" TEXT NOT NULL,
  "status" "ReassignmentStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeadReassignmentRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadReassignmentRequest_leadId_fkey'
  ) THEN
    ALTER TABLE "LeadReassignmentRequest"
      ADD CONSTRAINT "LeadReassignmentRequest_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadReassignmentRequest_tenantId_fkey'
  ) THEN
    ALTER TABLE "LeadReassignmentRequest"
      ADD CONSTRAINT "LeadReassignmentRequest_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadReassignmentRequest_requestedById_fkey'
  ) THEN
    ALTER TABLE "LeadReassignmentRequest"
      ADD CONSTRAINT "LeadReassignmentRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadReassignmentRequest_requestedOwnerId_fkey'
  ) THEN
    ALTER TABLE "LeadReassignmentRequest"
      ADD CONSTRAINT "LeadReassignmentRequest_requestedOwnerId_fkey"
      FOREIGN KEY ("requestedOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeadReassignmentRequest_resolvedById_fkey'
  ) THEN
    ALTER TABLE "LeadReassignmentRequest"
      ADD CONSTRAINT "LeadReassignmentRequest_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LeadReassignmentRequest_tenantId_status_idx"
ON "LeadReassignmentRequest"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "LeadReassignmentRequest_leadId_status_idx"
ON "LeadReassignmentRequest"("leadId", "status");