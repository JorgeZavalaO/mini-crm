-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "taxExempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "taxExempt" BOOLEAN NOT NULL DEFAULT false;
