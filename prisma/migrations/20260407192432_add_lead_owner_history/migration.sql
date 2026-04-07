-- AlterTable
ALTER TABLE "LeadReassignmentRequest" ADD COLUMN     "previousOwnerId" TEXT;

-- CreateTable
CREATE TABLE "LeadOwnerHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "previousOwnerId" TEXT,
    "newOwnerId" TEXT,
    "changedById" TEXT NOT NULL,
    "reassignmentRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadOwnerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadOwnerHistory_leadId_createdAt_idx" ON "LeadOwnerHistory"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadOwnerHistory_tenantId_idx" ON "LeadOwnerHistory"("tenantId");

-- AddForeignKey
ALTER TABLE "LeadOwnerHistory" ADD CONSTRAINT "LeadOwnerHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOwnerHistory" ADD CONSTRAINT "LeadOwnerHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOwnerHistory" ADD CONSTRAINT "LeadOwnerHistory_previousOwnerId_fkey" FOREIGN KEY ("previousOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOwnerHistory" ADD CONSTRAINT "LeadOwnerHistory_newOwnerId_fkey" FOREIGN KEY ("newOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOwnerHistory" ADD CONSTRAINT "LeadOwnerHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
