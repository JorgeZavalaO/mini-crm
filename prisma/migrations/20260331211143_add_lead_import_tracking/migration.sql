-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "importedById" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
