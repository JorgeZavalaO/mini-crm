-- CreateIndex
CREATE INDEX "Interaction_tenantId_leadId_occurredAt_idx" ON "Interaction"("tenantId", "leadId", "occurredAt");
