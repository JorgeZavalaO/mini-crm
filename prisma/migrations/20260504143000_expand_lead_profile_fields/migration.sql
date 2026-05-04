-- Expand lead profile with business metrics and detailed address fields.
ALTER TABLE "Lead"
ADD COLUMN "province" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "constitutionYear" INTEGER,
ADD COLUMN "employeeCount" INTEGER,
ADD COLUMN "importOperationCount" INTEGER,
ADD COLUMN "exportOperationCount" INTEGER;

CREATE INDEX "Lead_tenantId_country_idx" ON "Lead"("tenantId", "country");
CREATE INDEX "Lead_tenantId_province_idx" ON "Lead"("tenantId", "province");
CREATE INDEX "Lead_tenantId_district_idx" ON "Lead"("tenantId", "district");
CREATE INDEX "Lead_tenantId_constitutionYear_idx" ON "Lead"("tenantId", "constitutionYear");
CREATE INDEX "Lead_tenantId_employeeCount_idx" ON "Lead"("tenantId", "employeeCount");
CREATE INDEX "Lead_tenantId_importOperationCount_idx" ON "Lead"("tenantId", "importOperationCount");
CREATE INDEX "Lead_tenantId_exportOperationCount_idx" ON "Lead"("tenantId", "exportOperationCount");
