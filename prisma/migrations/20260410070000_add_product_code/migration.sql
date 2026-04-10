-- AlterTable: añadir campo code (código/SKU) al catálogo de productos
ALTER TABLE "Product" ADD COLUMN "code" VARCHAR(50);

-- Auto-generar código para productos existentes usando los primeros 6 caracteres de su id
UPDATE "Product" SET "code" = 'PRD-' || UPPER(SUBSTRING("id", 2, 6));

-- CreateIndex: código único por tenant (NULL no viola la restricción en PostgreSQL)
CREATE UNIQUE INDEX "Product_tenantId_code_key" ON "Product"("tenantId", "code");
