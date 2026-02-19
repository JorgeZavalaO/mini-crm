import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const prisma = new PrismaClient();

async function hash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const dk = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${dk.toString('hex')}`;
}

async function main() {
  console.log('🌱 Seeding Sprint 1 …');

  // ── Tenant demo ────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-logistics' },
    update: {},
    create: { name: 'Acme Logistics', slug: 'acme-logistics' },
  });

  // ── Super Admin (plataforma) ───────────────────────────
  const saPassword = await hash('changeme');
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@example.com',
      password: saPassword,
      isSuperAdmin: true,
    },
  });

  // ── Admin del tenant ───────────────────────────────────
  const adminPassword = await hash('admin123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      name: 'Admin Acme',
      email: 'admin@acme.com',
      password: adminPassword,
    },
  });

  // ── Vendedor del tenant ────────────────────────────────
  const vendedorPassword = await hash('vendedor123');
  const vendedor = await prisma.user.upsert({
    where: { email: 'vendedor@acme.com' },
    update: {},
    create: {
      name: 'Carlos Vendedor',
      email: 'vendedor@acme.com',
      password: vendedorPassword,
    },
  });

  // ── Memberships ────────────────────────────────────────
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
    where: { userId_tenantId: { userId: vendedor.id, tenantId: tenant.id } },
    update: {},
    create: { userId: vendedor.id, tenantId: tenant.id, role: 'VENDEDOR' },
  });

  // ── Lead de prueba ─────────────────────────────────────
  const existingLead = await prisma.lead.findFirst({
    where: { email: 'lead@example.com', tenantId: tenant.id },
  });

  if (!existingLead) {
    await prisma.lead.create({
      data: {
        name: 'Test Lead',
        company: 'Importers Inc',
        email: 'lead@example.com',
        phone: '+123456789',
        status: 'NEW',
        tenantId: tenant.id,
        assignedToId: vendedor.id,
      },
    });
  }

  console.log('✅ Seed completado');
  console.log('   Usuarios de prueba:');
  console.log('   ─ superadmin@example.com / changeme  (SuperAdmin)');
  console.log('   ─ admin@acme.com        / admin123   (Admin tenant)');
  console.log('   ─ vendedor@acme.com     / vendedor123 (Vendedor)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
