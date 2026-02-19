-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
