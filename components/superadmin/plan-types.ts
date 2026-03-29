import type { FeatureKey } from '@prisma/client';

export type SuperadminPlanRow = {
  id: string;
  name: string;
  description: string | null;
  maxUsers: number;
  maxStorageGb: number;
  retentionDays: number;
  isActive: boolean;
  tenantsCount: number;
  features: Array<{ featureKey: FeatureKey; enabled: boolean }>;
};
