import type { FeatureKey } from '@prisma/client';

export type FeatureConfig = Record<string, unknown>;

export const FEATURE_KEYS: FeatureKey[] = [
  'CRM_LEADS',
  'ASSIGNMENTS',
  'INTERACTIONS',
  'TASKS',
  'DOCUMENTS',
  'IMPORT',
  'DEDUPE',
  'DASHBOARD',
  'QUOTING_BASIC',
  'CLIENT_PORTAL',
  'NOTIFICATIONS',
];

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  CRM_LEADS: 'CRM Leads',
  ASSIGNMENTS: 'Asignaciones',
  INTERACTIONS: 'Interacciones',
  TASKS: 'Tareas',
  DOCUMENTS: 'Documentos',
  IMPORT: 'Importación',
  DEDUPE: 'Deduplicación',
  DASHBOARD: 'Dashboard',
  QUOTING_BASIC: 'Cotizaciones (básico)',
  CLIENT_PORTAL: 'Portal cliente',
  NOTIFICATIONS: 'Notificaciones',
};

export const FEATURE_DESCRIPTION: Record<FeatureKey, string> = {
  CRM_LEADS: 'Gestionar leads y pipeline comercial.',
  ASSIGNMENTS: 'Asignación de leads y responsables.',
  INTERACTIONS: 'Registro de llamadas, notas y seguimiento.',
  TASKS: 'Tareas y pendientes del equipo.',
  DOCUMENTS: 'Gestión de documentos por lead/cliente.',
  IMPORT: 'Importación masiva de datos.',
  DEDUPE: 'Detección y fusión de duplicados.',
  DASHBOARD: 'Panel principal con métricas.',
  QUOTING_BASIC: 'Cotización comercial básica.',
  CLIENT_PORTAL: 'Portal de acceso para clientes.',
  NOTIFICATIONS: 'Alertas y recordatorios.',
};

export const PLAN_FEATURE_BUNDLES: Record<
  'STARTER' | 'GROWTH' | 'SCALE',
  Partial<Record<FeatureKey, { enabled: boolean; config?: FeatureConfig }>>
> = {
  STARTER: {
    DASHBOARD: { enabled: true },
    CRM_LEADS: { enabled: true },
    ASSIGNMENTS: { enabled: true },
    INTERACTIONS: { enabled: true },
  },
  GROWTH: {
    DASHBOARD: { enabled: true },
    CRM_LEADS: { enabled: true },
    ASSIGNMENTS: { enabled: true },
    INTERACTIONS: { enabled: true },
    TASKS: { enabled: true },
    IMPORT: { enabled: true },
    DEDUPE: { enabled: true },
    NOTIFICATIONS: { enabled: true },
  },
  SCALE: {
    CRM_LEADS: { enabled: true },
    ASSIGNMENTS: { enabled: true },
    INTERACTIONS: { enabled: true },
    TASKS: { enabled: true },
    DOCUMENTS: { enabled: true },
    IMPORT: { enabled: true },
    DEDUPE: { enabled: true },
    DASHBOARD: { enabled: true },
    QUOTING_BASIC: { enabled: true },
    CLIENT_PORTAL: { enabled: true },
    NOTIFICATIONS: { enabled: true },
  },
};

export type PlanSeedDefinition = {
  key: 'STARTER' | 'GROWTH' | 'SCALE';
  name: string;
  description: string;
  maxUsers: number;
  maxStorageGb: number;
  retentionDays: number;
};

export const PLAN_SEEDS: PlanSeedDefinition[] = [
  {
    key: 'STARTER',
    name: 'Starter',
    description: 'Plan base para equipos pequeños.',
    maxUsers: 10,
    maxStorageGb: 5,
    retentionDays: 180,
  },
  {
    key: 'GROWTH',
    name: 'Growth',
    description: 'Plan intermedio para equipos en crecimiento.',
    maxUsers: 25,
    maxStorageGb: 25,
    retentionDays: 365,
  },
  {
    key: 'SCALE',
    name: 'Scale',
    description: 'Plan avanzado con catálogo completo.',
    maxUsers: 100,
    maxStorageGb: 100,
    retentionDays: 730,
  },
];
