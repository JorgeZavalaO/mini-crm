import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { getEnv } from '../lib/env';
import { FEATURE_KEYS, PLAN_FEATURE_BUNDLES, PLAN_SEEDS } from '../lib/feature-catalog';
import { logger } from '../lib/logger';
import { hashPassword } from '../lib/password';

const connectionString = getEnv().DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function seedPlans() {
  const plans = new Map<
    string,
    { id: string; maxUsers: number; maxStorageGb: number; retentionDays: number }
  >();

  for (const seed of PLAN_SEEDS) {
    const plan = await prisma.plan.upsert({
      where: { name: seed.name },
      update: {
        description: seed.description,
        maxUsers: seed.maxUsers,
        maxStorageGb: seed.maxStorageGb,
        retentionDays: seed.retentionDays,
        isActive: true,
      },
      create: {
        name: seed.name,
        description: seed.description,
        maxUsers: seed.maxUsers,
        maxStorageGb: seed.maxStorageGb,
        retentionDays: seed.retentionDays,
        isActive: true,
      },
    });

    plans.set(seed.key, {
      id: plan.id,
      maxUsers: plan.maxUsers,
      maxStorageGb: plan.maxStorageGb,
      retentionDays: plan.retentionDays,
    });

    const bundle = PLAN_FEATURE_BUNDLES[seed.key];
    for (const featureKey of FEATURE_KEYS) {
      const cfg = bundle[featureKey];
      await prisma.planFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: {
          enabled: cfg?.enabled ?? false,
          config: (cfg?.config as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
        create: {
          planId: plan.id,
          featureKey,
          enabled: cfg?.enabled ?? false,
          config: (cfg?.config as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        },
      });
    }
  }

  return plans;
}

async function main() {
  logger.info('Seeding data...');
  const plans = await seedPlans();
  const defaultTenantPlan = plans.get('GROWTH');
  if (!defaultTenantPlan) throw new Error('Growth plan not found while seeding');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-logistics' },
    update: {
      deletedAt: null,
      isActive: true,
      planId: defaultTenantPlan.id,
      maxUsers: defaultTenantPlan.maxUsers,
      maxStorageGb: defaultTenantPlan.maxStorageGb,
      retentionDays: defaultTenantPlan.retentionDays,
    },
    create: {
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      planId: defaultTenantPlan.id,
      maxUsers: defaultTenantPlan.maxUsers,
      maxStorageGb: defaultTenantPlan.maxStorageGb,
      retentionDays: defaultTenantPlan.retentionDays,
    },
  });

  const defaultPlanFeatures = await prisma.planFeature.findMany({
    where: { planId: defaultTenantPlan.id },
    select: { featureKey: true, enabled: true, config: true },
  });

  for (const feature of defaultPlanFeatures) {
    await prisma.tenantFeature.upsert({
      where: {
        tenantId_featureKey: {
          tenantId: tenant.id,
          featureKey: feature.featureKey,
        },
      },
      update: {
        enabled: feature.enabled,
        config: feature.config ?? Prisma.JsonNull,
      },
      create: {
        tenantId: tenant.id,
        featureKey: feature.featureKey,
        enabled: feature.enabled,
        config: feature.config ?? Prisma.JsonNull,
      },
    });
  }

  const superAdminPasswordHash = await hashPassword('changeme');
  const adminPasswordHash = await hashPassword('admin123');
  const sellerPasswordHash = await hashPassword('vendedor123');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {
      name: 'Super Admin',
      password: superAdminPasswordHash,
      isSuperAdmin: true,
    },
    create: {
      name: 'Super Admin',
      email: 'superadmin@example.com',
      password: superAdminPasswordHash,
      isSuperAdmin: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {
      name: 'Admin Acme',
      password: adminPasswordHash,
      isSuperAdmin: false,
    },
    create: {
      name: 'Admin Acme',
      email: 'admin@acme.com',
      password: adminPasswordHash,
      isSuperAdmin: false,
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: 'vendedor@acme.com' },
    update: {
      name: 'Carlos Vendedor',
      password: sellerPasswordHash,
      isSuperAdmin: false,
    },
    create: {
      name: 'Carlos Vendedor',
      email: 'vendedor@acme.com',
      password: sellerPasswordHash,
      isSuperAdmin: false,
    },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: superAdmin.id, tenantId: tenant.id } },
    update: { role: 'ADMIN', isActive: true },
    create: { userId: superAdmin.id, tenantId: tenant.id, role: 'ADMIN' },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: adminUser.id, tenantId: tenant.id } },
    update: { role: 'ADMIN', isActive: true },
    create: { userId: adminUser.id, tenantId: tenant.id, role: 'ADMIN' },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: seller.id, tenantId: tenant.id } },
    update: { role: 'VENDEDOR', isActive: true },
    create: { userId: seller.id, tenantId: tenant.id, role: 'VENDEDOR' },
  });

  const seedLeads = [
    {
      businessName: 'Importers Inc',
      ruc: '20123456789',
      rucNormalized: '20123456789',
      nameNormalized: 'importers inc',
      country: 'Peru',
      city: 'Lima',
      industry: 'Comercio exterior',
      source: 'Referido',
      notes: 'Cliente potencial para importacion maritima.',
      phones: ['+51 999 111 222'],
      emails: ['lead@example.com'],
      status: 'NEW' as const,
      ownerId: seller.id,
    },
    {
      businessName: 'Logistica Andina SAC',
      ruc: '20555888991',
      rucNormalized: '20555888991',
      nameNormalized: 'logistica andina sac',
      country: 'Peru',
      city: 'Arequipa',
      industry: 'Logistica',
      source: 'Web',
      notes: 'Solicito cotizacion inicial.',
      phones: ['+51 955 888 777'],
      emails: ['contacto@logisticaandina.pe'],
      status: 'CONTACTED' as const,
      ownerId: null,
    },
  ];

  for (const lead of seedLeads) {
    const existingLead = await prisma.lead.findFirst({
      where: {
        tenantId: tenant.id,
        rucNormalized: lead.rucNormalized,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!existingLead) {
      await prisma.lead.create({
        data: {
          ...lead,
          tenantId: tenant.id,
        },
      });
    }
  }

  logger.info('Seed complete');
  logger.info('Demo credentials and baseline memberships refreshed for local QA');
  logger.info('Test users:', [
    'superadmin@example.com / changeme (SuperAdmin)',
    'admin@acme.com / admin123 (Tenant Admin)',
    'vendedor@acme.com / vendedor123 (Seller)',
  ]);
}

main()
  .catch((e) => {
    logger.error('Seed failed', { error: e });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
