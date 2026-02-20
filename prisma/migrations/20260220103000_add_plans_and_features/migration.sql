-- CreateEnum
CREATE TYPE "FeatureKey" AS ENUM (
  'CRM_LEADS',
  'ASSIGNMENTS',
  'INTERACTIONS',
  'TASKS',
  'DOCUMENTS',
  'IMPORT',
  'DEDUPE',
  'DASHBOARD',
  'QUOTING_BASIC',
  'CLIENT_PORTAL',
  'NOTIFICATIONS'
);

-- AlterTable
ALTER TABLE "Tenant"
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "maxUsers" INTEGER,
  ADD COLUMN "maxStorageGb" INTEGER,
  ADD COLUMN "retentionDays" INTEGER,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "maxUsers" INTEGER NOT NULL,
  "maxStorageGb" INTEGER NOT NULL,
  "retentionDays" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFeature" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "featureKey" "FeatureKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeature" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "featureKey" "FeatureKey" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFeature_planId_featureKey_key" ON "PlanFeature"("planId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeature_tenantId_featureKey_key" ON "TenantFeature"("tenantId", "featureKey");

-- CreateIndex
CREATE INDEX "Tenant_deletedAt_idx" ON "Tenant"("deletedAt");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeature" ADD CONSTRAINT "TenantFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
