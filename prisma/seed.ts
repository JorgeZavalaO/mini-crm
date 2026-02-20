import { Prisma, PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { FEATURE_KEYS, PLAN_FEATURE_BUNDLES, PLAN_SEEDS } from '../lib/feature-catalog';

const scrypt = promisify(scryptCallback);
const prisma = new PrismaClient();

async function hash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const dk = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${dk.toString('hex')}`;
}

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
  console.log('Seeding data...');
  const plans = await seedPlans();
  const starter = plans.get('STARTER');
  if (!starter) throw new Error('Starter plan not found while seeding');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-logistics' },
    update: {
      deletedAt: null,
      isActive: true,
      planId: starter.id,
      maxUsers: starter.maxUsers,
      maxStorageGb: starter.maxStorageGb,
      retentionDays: starter.retentionDays,
    },
    create: {
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      planId: starter.id,
      maxUsers: starter.maxUsers,
      maxStorageGb: starter.maxStorageGb,
      retentionDays: starter.retentionDays,
    },
  });

  const starterPlanFeatures = await prisma.planFeature.findMany({
    where: { planId: starter.id },
    select: { featureKey: true, enabled: true, config: true },
  });

  for (const feature of starterPlanFeatures) {
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

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@example.com',
      password: await hash('changeme'),
      isSuperAdmin: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      name: 'Admin Acme',
      email: 'admin@acme.com',
      password: await hash('admin123'),
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: 'vendedor@acme.com' },
    update: {},
    create: {
      name: 'Carlos Vendedor',
      email: 'vendedor@acme.com',
      password: await hash('vendedor123'),
    },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: superAdmin.id, tenantId: tenant.id } },
    update: {},
    create: { userId: superAdmin.id, tenantId: tenant.id, role: 'ADMIN' },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: adminUser.id, tenantId: tenant.id } },
    update: {},
    create: { userId: adminUser.id, tenantId: tenant.id, role: 'ADMIN' },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: seller.id, tenantId: tenant.id } },
    update: {},
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

  console.log('Seed complete');
  console.log('Test users:');
  console.log(' - superadmin@example.com / changeme (SuperAdmin)');
  console.log(' - admin@acme.com / admin123 (Tenant Admin)');
  console.log(' - vendedor@acme.com / vendedor123 (Seller)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
