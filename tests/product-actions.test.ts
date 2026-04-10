import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { getTenantActionContextBySlugMock } = vi.hoisted(() => ({
  getTenantActionContextBySlugMock: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({
  getTenantActionContextBySlug: getTenantActionContextBySlugMock,
}));

const dbMock = vi.hoisted(() => ({
  product: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  createProductAction,
  deleteProductAction,
  listProductsAction,
  updateProductAction,
} from '@/lib/product-actions';

const TENANT_ID = 'tenant-p1';
const TENANT_SLUG = 'acme';
const PRODUCT_ID = 'product-1';
const USER_ID = 'user-a';

function makeAdminContext() {
  return {
    session: { user: { id: USER_ID, isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role: 'ADMIN', isActive: true },
  };
}

function makeVendedorContext() {
  return {
    session: { user: { id: USER_ID, isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-2', role: 'VENDEDOR', isActive: true },
  };
}

const validProductRow = {
  id: PRODUCT_ID,
  code: 'PRD-ABCDEF',
  tenantId: TENANT_ID,
  name: 'Servicio A',
  description: null,
  unitPrice: { toNumber: () => 100 },
  currency: 'PEN',
  isActive: true,
  taxExempt: false,
  createdById: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  getTenantActionContextBySlugMock.mockResolvedValue(makeAdminContext());
  dbMock.product.create.mockResolvedValue(validProductRow);
  dbMock.product.findFirst.mockResolvedValue(validProductRow);
  dbMock.product.update.mockResolvedValue(validProductRow);
  dbMock.product.count.mockResolvedValue(0);
  dbMock.product.findMany.mockResolvedValue([]);
});

describe('createProductAction', () => {
  it('creates product with valid data', async () => {
    const result = await createProductAction({
      tenantSlug: TENANT_SLUG,
      name: 'Servicio A',
      unitPrice: 100,
      currency: 'PEN',
    });
    expect(result.success).toBe(true);
    expect(dbMock.product.create).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('throws on invalid data (missing name)', async () => {
    await expect(
      createProductAction({
        tenantSlug: TENANT_SLUG,
        unitPrice: 100,
        currency: 'PEN',
      }),
    ).rejects.toThrow();
    expect(dbMock.product.create).not.toHaveBeenCalled();
  });

  it('throws 403 when role is VENDEDOR', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    await expect(
      createProductAction({
        tenantSlug: TENANT_SLUG,
        name: 'Producto B',
        unitPrice: 50,
        currency: 'USD',
      }),
    ).rejects.toThrow();
    expect(dbMock.product.create).not.toHaveBeenCalled();
  });

  it('throws when membership is inactive', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue({
      ...makeAdminContext(),
      membership: { id: 'm1', role: 'ADMIN', isActive: false },
    });
    await expect(
      createProductAction({
        tenantSlug: TENANT_SLUG,
        name: 'X',
        unitPrice: 1,
        currency: 'PEN',
      }),
    ).rejects.toThrow();
  });
});

describe('updateProductAction', () => {
  it('updates existing product', async () => {
    const result = await updateProductAction({
      tenantSlug: TENANT_SLUG,
      productId: PRODUCT_ID,
      name: 'Servicio Actualizado',
      unitPrice: 200,
      currency: 'USD',
    });
    expect(result.success).toBe(true);
    expect(dbMock.product.update).toHaveBeenCalledOnce();
  });

  it('throws 404 when product not found', async () => {
    dbMock.product.findFirst.mockResolvedValue(null);
    await expect(
      updateProductAction({
        tenantSlug: TENANT_SLUG,
        productId: 'nonexistent',
        name: 'X',
        unitPrice: 1,
        currency: 'PEN',
      }),
    ).rejects.toThrow();
  });

  it('toggles isActive without other changes', async () => {
    const result = await updateProductAction({
      tenantSlug: TENANT_SLUG,
      productId: PRODUCT_ID,
      isActive: false,
    });
    expect(result.success).toBe(true);
    expect(dbMock.product.update).toHaveBeenCalledOnce();
  });
});

describe('deleteProductAction', () => {
  it('soft-deletes existing product', async () => {
    const result = await deleteProductAction({
      tenantSlug: TENANT_SLUG,
      productId: PRODUCT_ID,
    });
    expect(result.success).toBe(true);
    const updateCall = dbMock.product.update.mock.calls[0]?.[0];
    expect(updateCall?.data?.deletedAt).toBeInstanceOf(Date);
  });

  it('throws 404 when product not found', async () => {
    dbMock.product.findFirst.mockResolvedValue(null);
    await expect(
      deleteProductAction({ tenantSlug: TENANT_SLUG, productId: 'ghost' }),
    ).rejects.toThrow();
  });

  it('throws 403 for VENDEDOR', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    await expect(
      deleteProductAction({ tenantSlug: TENANT_SLUG, productId: PRODUCT_ID }),
    ).rejects.toThrow();
  });
});

describe('listProductsAction', () => {
  it('returns empty list by default', async () => {
    const result = await listProductsAction({ tenantSlug: TENANT_SLUG });
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('returns products when present', async () => {
    dbMock.product.count.mockResolvedValue(1);
    dbMock.product.findMany.mockResolvedValue([validProductRow]);
    const result = await listProductsAction({ tenantSlug: TENANT_SLUG });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Servicio A');
    expect(result.total).toBe(1);
  });

  it('throws on invalid tenantSlug', async () => {
    await expect(listProductsAction({ tenantSlug: '' })).rejects.toThrow();
  });
});

describe('taxExempt support', () => {
  it('creates product with taxExempt=true', async () => {
    const result = await createProductAction({
      tenantSlug: TENANT_SLUG,
      name: 'Producto exonerado',
      unitPrice: 50,
      currency: 'PEN',
      taxExempt: true,
    });
    expect(result.success).toBe(true);
    const createCall = dbMock.product.create.mock.calls[0]?.[0];
    expect(createCall?.data?.taxExempt).toBe(true);
  });

  it('creates product with taxExempt=false by default', async () => {
    await createProductAction({
      tenantSlug: TENANT_SLUG,
      name: 'Producto normal',
      unitPrice: 100,
      currency: 'PEN',
    });
    const createCall = dbMock.product.create.mock.calls[0]?.[0];
    expect(createCall?.data?.taxExempt).toBe(false);
  });

  it('updates taxExempt on existing product', async () => {
    const result = await updateProductAction({
      tenantSlug: TENANT_SLUG,
      productId: PRODUCT_ID,
      taxExempt: true,
    });
    expect(result.success).toBe(true);
    const updateCall = dbMock.product.update.mock.calls[0]?.[0];
    expect(updateCall?.data?.taxExempt).toBe(true);
  });

  it('listProductsAction returns taxExempt field in product rows', async () => {
    const exemptRow = { ...validProductRow, taxExempt: true };
    dbMock.product.count.mockResolvedValue(1);
    dbMock.product.findMany.mockResolvedValue([exemptRow]);
    const result = await listProductsAction({ tenantSlug: TENANT_SLUG });
    expect(result.products[0].taxExempt).toBe(true);
  });
});
