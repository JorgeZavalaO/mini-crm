'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getTenantActionContextBySlug } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { getPaginationState } from '@/lib/pagination';
import {
  createProductSchema,
  deleteProductSchema,
  productFiltersSchema,
  updateProductSchema,
} from '@/lib/validators';

async function getProductContext(tenantSlug: string) {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  const userId = ctx.session.user.id;
  const isSuperAdmin = ctx.session.user.isSuperAdmin;
  const role = ctx.membership?.role ?? null;
  const isActiveMember = isSuperAdmin || Boolean(ctx.membership?.isActive);

  if (!isActiveMember) {
    throw new AppError('No autorizado', 403);
  }

  return { tenantId: ctx.tenant.id, tenantSlug, userId, role, isSuperAdmin, isActiveMember };
}

function canManageProducts(ctx: { role: string | null; isSuperAdmin: boolean }) {
  if (ctx.isSuperAdmin) return true;
  return ctx.role === 'ADMIN' || ctx.role === 'SUPERVISOR';
}

function revalidateProductViews(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/products`);
  revalidatePath(`/${tenantSlug}/quotes`);
}

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  currency: 'PEN' | 'USD';
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createProductAction(input: unknown) {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, name, description, unitPrice, currency } = parsed.data;
  const ctx = await getProductContext(tenantSlug);

  if (!canManageProducts(ctx)) {
    throw new AppError('Solo SUPERVISOR o ADMIN pueden gestionar el catálogo', 403);
  }

  await db.product.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      description: description ?? null,
      unitPrice: new Prisma.Decimal(unitPrice),
      currency,
      createdById: ctx.userId,
    },
  });

  revalidateProductViews(tenantSlug);
  return { success: true };
}

export async function updateProductAction(input: unknown) {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, productId, name, description, unitPrice, currency, isActive } = parsed.data;
  const ctx = await getProductContext(tenantSlug);

  if (!canManageProducts(ctx)) {
    throw new AppError('Solo SUPERVISOR o ADMIN pueden gestionar el catálogo', 403);
  }

  const existing = await db.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new AppError('Producto no encontrado', 404);

  await db.product.update({
    where: { id: productId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description ?? null }),
      ...(unitPrice !== undefined && { unitPrice: new Prisma.Decimal(unitPrice) }),
      ...(currency !== undefined && { currency }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  revalidateProductViews(tenantSlug);
  return { success: true };
}

export async function deleteProductAction(input: unknown) {
  const parsed = deleteProductSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }

  const { tenantSlug, productId } = parsed.data;
  const ctx = await getProductContext(tenantSlug);

  if (!canManageProducts(ctx)) {
    throw new AppError('Solo SUPERVISOR o ADMIN pueden eliminar productos', 403);
  }

  const existing = await db.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new AppError('Producto no encontrado', 404);

  await db.product.update({
    where: { id: productId },
    data: { deletedAt: new Date() },
  });

  revalidateProductViews(tenantSlug);
  return { success: true };
}

export async function listProductsAction(
  input: unknown,
): Promise<{ products: ProductRow[]; total: number }> {
  const parsed = productFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, q, isActive, currency, page, pageSize } = parsed.data;
  const ctx = await getProductContext(tenantSlug);

  const where: Prisma.ProductWhereInput = {
    tenantId: ctx.tenantId,
    deletedAt: null,
    isActive: isActive ?? undefined,
    currency: currency ?? undefined,
    name: q ? { contains: q, mode: 'insensitive' } : undefined,
  };

  const total = await db.product.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const products = await db.product.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      name: true,
      description: true,
      unitPrice: true,
      currency: true,
      isActive: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    products: products.map((p) => ({
      ...p,
      unitPrice: Number(p.unitPrice),
      currency: p.currency as 'PEN' | 'USD',
    })),
    total,
  };
}
