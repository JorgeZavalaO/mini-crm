-- Add REPORTS feature to tenant/plan feature catalog
DO $$
BEGIN
  ALTER TYPE "FeatureKey" ADD VALUE IF NOT EXISTS 'REPORTS';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
