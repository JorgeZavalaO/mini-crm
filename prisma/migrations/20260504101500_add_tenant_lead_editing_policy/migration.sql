-- Add tenant-level policy to keep lead editing restricted by owner by default.
-- Safe for production: constant DEFAULT on PostgreSQL avoids rewriting existing rows.
ALTER TABLE "Tenant"
ADD COLUMN "restrictLeadEditingToOwner" BOOLEAN NOT NULL DEFAULT true;
