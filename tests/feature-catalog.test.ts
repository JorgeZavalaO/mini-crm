import { describe, expect, it } from 'vitest';
import { PLAN_FEATURE_BUNDLES } from '@/lib/feature-catalog';

describe('feature catalog - sprint 4 bundles', () => {
  it('habilita IMPORT y DEDUPE para Growth y Scale, pero no para Starter', () => {
    expect(PLAN_FEATURE_BUNDLES.STARTER.IMPORT?.enabled ?? false).toBe(false);
    expect(PLAN_FEATURE_BUNDLES.STARTER.DEDUPE?.enabled ?? false).toBe(false);

    expect(PLAN_FEATURE_BUNDLES.GROWTH.IMPORT?.enabled).toBe(true);
    expect(PLAN_FEATURE_BUNDLES.GROWTH.DEDUPE?.enabled).toBe(true);

    expect(PLAN_FEATURE_BUNDLES.SCALE.IMPORT?.enabled).toBe(true);
    expect(PLAN_FEATURE_BUNDLES.SCALE.DEDUPE?.enabled).toBe(true);
  });

  it('mantiene DOCUMENTS como capacidad exclusiva de Scale', () => {
    expect(PLAN_FEATURE_BUNDLES.STARTER.DOCUMENTS?.enabled ?? false).toBe(false);
    expect(PLAN_FEATURE_BUNDLES.GROWTH.DOCUMENTS?.enabled ?? false).toBe(false);
    expect(PLAN_FEATURE_BUNDLES.SCALE.DOCUMENTS?.enabled).toBe(true);
  });
});
