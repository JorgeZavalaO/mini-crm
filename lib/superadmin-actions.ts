'use server';

import { Prisma, type FeatureKey } from '@prisma/client';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { FEATURE_KEYS } from '@/lib/feature-catalog';
import { materializeTenantFeaturesFromPlan } from '@/lib/feature-service';
import { hashPassword } from '@/lib/password';
import { revalidatePath } from 'next/cache';

type ActionState = { error?: string; success?: string };

async function assertSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    throw new Error('No autorizado');
  }
}

function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function parseEnabledFeatures(formData: FormData): FeatureKey[] {
  const all = formData.getAll('enabledFeatures');
  const asStrings = all.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (asStrings.length === 0) return [];

  if (asStrings.length === 1 && asStrings[0].trim().startsWith('[')) {
    try {
      const arr = JSON.parse(asStrings[0]) as string[];
      return arr.filter((key): key is FeatureKey => FEATURE_KEYS.includes(key as FeatureKey));
    } catch {
      return [];
    }
  }

  return asStrings.filter((key): key is FeatureKey => FEATURE_KEYS.includes(key as FeatureKey));
}

async function revalidateTenantViews(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  revalidatePath('/superadmin');
  revalidatePath(`/superadmin/tenants/${tenantId}`);

  if (!tenant) return;
  revalidatePath(`/${tenant.slug}/dashboard`);
  revalidatePath(`/${tenant.slug}/leads`);
  revalidatePath(`/${tenant.slug}/documents`);
  revalidatePath(`/${tenant.slug}/team`);
}

export async function createPlanAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await assertSuperAdmin();

  const name = (formData.get('name') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const maxUsers = parsePositiveInt(formData.get('maxUsers'));
  const maxStorageGb = parsePositiveInt(formData.get('maxStorageGb'));
  const retentionDays = parsePositiveInt(formData.get('retentionDays'));
  const enabledFeatures = parseEnabledFeatures(formData);

  if (!name || !maxUsers || !maxStorageGb || !retentionDays) {
    return { error: 'Todos los limites del plan son requeridos y deben ser numeros positivos' };
  }

  const exists = await db.plan.findUnique({ where: { name } });
  if (exists) {
    return { error: 'Ya existe un plan con ese nombre' };
  }

  const enabledSet = new Set(enabledFeatures);

  await db.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        name,
        description: description || null,
        maxUsers,
        maxStorageGb,
        retentionDays,
        isActive: true,
      },
    });

    for (const featureKey of FEATURE_KEYS) {
      await tx.planFeature.create({
        data: {
          planId: plan.id,
          featureKey,
          enabled: enabledSet.has(featureKey),
          config: Prisma.JsonNull,
        },
      });
    }
  });

  revalidatePath('/superadmin/plans');
  return { success: 'Plan creado' };
}

export async function updatePlanAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await assertSuperAdmin();

  const planId = (formData.get('planId') as string | null)?.trim();
  const name = (formData.get('name') as string | null)?.trim();
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const maxUsers = parsePositiveInt(formData.get('maxUsers'));
  const maxStorageGb = parsePositiveInt(formData.get('maxStorageGb'));
  const retentionDays = parsePositiveInt(formData.get('retentionDays'));
  const enabledFeatures = parseEnabledFeatures(formData);

  if (!planId || !name || !maxUsers || !maxStorageGb || !retentionDays) {
    return { error: 'Datos invalidos para actualizar plan' };
  }

  const enabledSet = new Set(enabledFeatures);

  await db.$transaction(async (tx) => {
    await tx.plan.update({
      where: { id: planId },
      data: {
        name,
        description: description || null,
        maxUsers,
        maxStorageGb,
        retentionDays,
      },
    });

    for (const featureKey of FEATURE_KEYS) {
      await tx.planFeature.upsert({
        where: { planId_featureKey: { planId, featureKey } },
        update: { enabled: enabledSet.has(featureKey) },
        create: {
          planId,
          featureKey,
          enabled: enabledSet.has(featureKey),
          config: Prisma.JsonNull,
        },
      });
    }
  });

  revalidatePath('/superadmin/plans');
  return { success: 'Plan actualizado' };
}

export async function togglePlanAction(planId: string) {
  await assertSuperAdmin();
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('Plan no encontrado');

  const updated = await db.plan.update({
    where: { id: planId },
    data: { isActive: !plan.isActive },
  });

  revalidatePath('/superadmin/plans');
  return { success: true, isActive: updated.isActive };
}

export async function createTenantAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await assertSuperAdmin();

  const companyName = (formData.get('companyName') as string | null)?.trim();
  const slug = (formData.get('slug') as string | null)?.trim().toLowerCase();
  const adminName = (formData.get('adminName') as string | null)?.trim();
  const adminEmail = (formData.get('adminEmail') as string | null)?.trim().toLowerCase();
  const adminPassword = (formData.get('adminPassword') as string | null) ?? '';
  const planId = (formData.get('planId') as string | null)?.trim();

  if (!companyName || !slug || !adminName || !adminEmail || !adminPassword || !planId) {
    return { error: 'Todos los campos son requeridos' };
  }
  if (adminPassword.length < 6) {
    return { error: 'La contrasena debe tener al menos 6 caracteres' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: 'Slug invalido. Usa minusculas, numeros y guiones' };
  }

  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    return { error: 'El plan seleccionado no esta disponible' };
  }

  const [existingTenant, existingUser] = await Promise.all([
    db.tenant.findUnique({ where: { slug } }),
    db.user.findUnique({ where: { email: adminEmail } }),
  ]);

  if (existingTenant) {
    return { error: 'Ya existe una empresa con ese slug' };
  }
  if (existingUser) {
    return { error: 'Ya existe un usuario con ese email' };
  }

  const hashed = await hashPassword(adminPassword);

  await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: companyName,
        slug,
        planId: plan.id,
        maxUsers: plan.maxUsers,
        maxStorageGb: plan.maxStorageGb,
        retentionDays: plan.retentionDays,
      },
    });

    const user = await tx.user.create({
      data: { name: adminName, email: adminEmail, password: hashed },
    });

    await tx.membership.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' },
    });

    const planFeatures = await tx.planFeature.findMany({
      where: { planId: plan.id },
      select: { featureKey: true, enabled: true, config: true },
    });
    const featureMap = new Map(planFeatures.map((f) => [f.featureKey, f]));

    for (const featureKey of FEATURE_KEYS) {
      const feature = featureMap.get(featureKey);
      await tx.tenantFeature.create({
        data: {
          tenantId: tenant.id,
          featureKey,
          enabled: feature?.enabled ?? false,
          config: feature?.config ?? Prisma.JsonNull,
        },
      });
    }
  });

  revalidatePath('/superadmin');
  return { success: 'Empresa creada correctamente' };
}

export async function updateTenantBasicsAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await assertSuperAdmin();

  const tenantId = (formData.get('tenantId') as string | null)?.trim();
  const name = (formData.get('name') as string | null)?.trim();
  const slug = (formData.get('slug') as string | null)?.trim().toLowerCase();

  if (!tenantId || !name || !slug) {
    return { error: 'Nombre y slug son requeridos' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: 'Slug invalido' };
  }

  const existing = await db.tenant.findUnique({ where: { slug } });
  if (existing && existing.id !== tenantId) {
    return { error: 'Ese slug ya esta en uso' };
  }

  await db.tenant.update({ where: { id: tenantId }, data: { name, slug } });
  await revalidateTenantViews(tenantId);
  return { success: 'Tenant actualizado' };
}

export async function updateTenantPlanAndLimitsAction(
  _prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await assertSuperAdmin();

  const tenantId = (formData.get('tenantId') as string | null)?.trim();
  const planId = (formData.get('planId') as string | null)?.trim();
  const maxUsers = parsePositiveInt(formData.get('maxUsers'));
  const maxStorageGb = parsePositiveInt(formData.get('maxStorageGb'));
  const retentionDays = parsePositiveInt(formData.get('retentionDays'));
  const applyFeatureBundle = (formData.get('applyFeatureBundle') as string | null) === 'true';

  if (!tenantId || !planId || !maxUsers || !maxStorageGb || !retentionDays) {
    return { error: 'Plan y limites son requeridos' };
  }

  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return { error: 'Plan no encontrado' };
  }

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      planId,
      maxUsers,
      maxStorageGb,
      retentionDays,
    },
  });

  if (applyFeatureBundle) {
    await materializeTenantFeaturesFromPlan(tenantId, planId, true);
  } else {
    await materializeTenantFeaturesFromPlan(tenantId, planId, false);
  }

  await revalidateTenantViews(tenantId);
  return { success: 'Plan y limites actualizados' };
}

export async function toggleTenantAction(
  tenantId: string,
): Promise<{ success: boolean; isActive: boolean; name: string }> {
  await assertSuperAdmin();

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant no encontrado');
  if (tenant.deletedAt) throw new Error('No se puede activar/desactivar un tenant dado de baja');

  const updated = await db.tenant.update({
    where: { id: tenantId },
    data: { isActive: !tenant.isActive },
  });

  await revalidateTenantViews(tenantId);
  return { success: true, isActive: updated.isActive, name: updated.name };
}

export async function softDeleteTenantAction(tenantId: string) {
  await assertSuperAdmin();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant no encontrado');

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      deletedAt: new Date(),
      isActive: false,
    },
  });

  await revalidateTenantViews(tenantId);
  return { success: true };
}

export async function restoreTenantAction(tenantId: string) {
  await assertSuperAdmin();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant no encontrado');

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      deletedAt: null,
      isActive: false,
    },
  });

  await revalidateTenantViews(tenantId);
  return { success: true };
}

export async function setTenantFeatureAction(
  tenantId: string,
  featureKey: FeatureKey,
  enabled: boolean,
  configText?: string,
) {
  await assertSuperAdmin();
  if (!FEATURE_KEYS.includes(featureKey)) {
    throw new Error('Feature invalida');
  }

  let parsedConfig: unknown = null;
  if (configText && configText.trim()) {
    try {
      parsedConfig = JSON.parse(configText);
    } catch {
      throw new Error('Config JSON invalido');
    }
  }

  const normalizedConfig =
    parsedConfig === null ? Prisma.JsonNull : (parsedConfig as Prisma.InputJsonValue);

  await db.tenantFeature.upsert({
    where: { tenantId_featureKey: { tenantId, featureKey } },
    update: { enabled, config: normalizedConfig },
    create: {
      tenantId,
      featureKey,
      enabled,
      config: normalizedConfig,
    },
  });

  await revalidateTenantViews(tenantId);
  return { success: true };
}
