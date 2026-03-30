import { describe, expect, it } from 'vitest';
import {
  COMING_SOON_FEATURE_KEYS,
  PLAN_FEATURE_BUNDLES,
  SUPPORTED_FEATURE_KEYS,
} from '@/lib/feature-catalog';

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

  it('no marca como soportadas las features futuras aun no implementadas', () => {
    expect(SUPPORTED_FEATURE_KEYS).not.toContain('TASKS');
    expect(SUPPORTED_FEATURE_KEYS).not.toContain('NOTIFICATIONS');
    expect(SUPPORTED_FEATURE_KEYS).not.toContain('CLIENT_PORTAL');
    expect(SUPPORTED_FEATURE_KEYS).not.toContain('QUOTING_BASIC');
  });

  it('marca INTERACTIONS como feature soportada disponible en GROWTH y SCALE', () => {
    expect(SUPPORTED_FEATURE_KEYS).toContain('INTERACTIONS');
    expect(PLAN_FEATURE_BUNDLES.STARTER.INTERACTIONS?.enabled ?? false).toBe(false);
    expect(PLAN_FEATURE_BUNDLES.GROWTH.INTERACTIONS?.enabled).toBe(true);
    expect(PLAN_FEATURE_BUNDLES.SCALE.INTERACTIONS?.enabled).toBe(true);
  });

  it('mantiene las features futuras deshabilitadas en todos los bundles', () => {
    for (const featureKey of COMING_SOON_FEATURE_KEYS) {
      expect(PLAN_FEATURE_BUNDLES.STARTER[featureKey]?.enabled ?? false).toBe(false);
      expect(PLAN_FEATURE_BUNDLES.GROWTH[featureKey]?.enabled ?? false).toBe(false);
      expect(PLAN_FEATURE_BUNDLES.SCALE[featureKey]?.enabled ?? false).toBe(false);
    }
  });
});
