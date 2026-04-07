BEGIN;

DELETE FROM "PortalToken";

ALTER TABLE "Tenant"
ADD COLUMN "quoteSequence" INTEGER NOT NULL DEFAULT 0;

UPDATE "Tenant" AS t
SET "quoteSequence" = COALESCE(
  (
    SELECT MAX(((regexp_match(q."quoteNumber", '([0-9]+)$'))[1])::INTEGER)
    FROM "Quote" AS q
    WHERE q."tenantId" = t."id"
      AND q."deletedAt" IS NULL
      AND q."quoteNumber" ~ '([0-9]+)$'
  ),
  (
    SELECT COUNT(*)::INTEGER
    FROM "Quote" AS q
    WHERE q."tenantId" = t."id"
      AND q."deletedAt" IS NULL
  ),
  0
);

ALTER TABLE "PortalToken"
DROP CONSTRAINT IF EXISTS "PortalToken_token_key";

ALTER TABLE "PortalToken"
DROP COLUMN "token";

ALTER TABLE "PortalToken"
ADD COLUMN "tokenHash" TEXT NOT NULL;

CREATE UNIQUE INDEX "PortalToken_tokenHash_key" ON "PortalToken"("tokenHash");

COMMIT;
