-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "companyAddress" VARCHAR(400),
ADD COLUMN     "companyEmail" VARCHAR(200),
ADD COLUMN     "companyLogoPathname" TEXT,
ADD COLUMN     "companyLogoUrl" TEXT,
ADD COLUMN     "companyName" VARCHAR(200),
ADD COLUMN     "companyPhone" VARCHAR(50),
ADD COLUMN     "companyRuc" VARCHAR(20),
ADD COLUMN     "companyWebsite" VARCHAR(200);
