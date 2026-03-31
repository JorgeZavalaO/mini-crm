import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { getTenantActionContextBySlugMock, assertTenantFeatureByIdMock } = vi.hoisted(() => ({
  getTenantActionContextBySlugMock: vi.fn(),
  assertTenantFeatureByIdMock: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({
  getTenantActionContextBySlug: getTenantActionContextBySlugMock,
  assertTenantFeatureById: assertTenantFeatureByIdMock,
}));

const dbMock = vi.hoisted(() => ({
  lead: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  membership: {
    findUnique: vi.fn(),
  },
  leadReassignmentRequest: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

// Prisma module mock — solo el error necesario para tests de P2002
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      PrismaClientKnownRequestError: class extends Error {
        code: string;
        constructor(msg: string, opts: { code: string; clientVersion: string }) {
          super(msg);
          this.code = opts.code;
        }
      },
    },
    ReassignmentStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
  };
});

import {
  archiveLeadAction,
  assignLeadAction,
  bulkAssignLeadsAction,
  createLeadAction,
  requestLeadReassignmentAction,
  resolveLeadReassignmentAction,
  updateLeadAction,
} from '@/lib/lead-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';
const LEAD_ID = 'lead-1';
const USER_ID = 'user-1';
const OWNER_ID = 'owner-1';

function makeSupervisorContext(userId = USER_ID) {
  return {
    session: { user: { id: userId, isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role: 'SUPERVISOR', isActive: true },
  };
}

function makeVendedorContext(userId = USER_ID) {
  return {
    ...makeSupervisorContext(userId),
    membership: { id: 'mem-1', role: 'VENDEDOR', isActive: true },
  };
}

function makeOwnerMembership() {
  return { userId: OWNER_ID, isActive: true, role: 'VENDEDOR' };
}

const VALID_CREATE_INPUT = {
  tenantSlug: TENANT_SLUG,
  businessName: 'Empresa Test S.A.',
  status: 'NEW',
};

const VALID_UPDATE_INPUT = {
  tenantSlug: TENANT_SLUG,
  leadId: LEAD_ID,
  businessName: 'Empresa Test Actualizada',
  status: 'CONTACTED',
};

describe('createLeadAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findFirst.mockResolvedValue(null); // sin RUC duplicado
    dbMock.lead.create.mockResolvedValue({ id: LEAD_ID });
  });

  it('lanza AppError cuando los datos de entrada no superan la validación del schema', async () => {
    await expect(createLeadAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('crea el lead y retorna el id correcto', async () => {
    const result = await createLeadAction(VALID_CREATE_INPUT);

    expect(result).toEqual({ success: true, leadId: LEAD_ID });
    expect(dbMock.lead.create).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads`);
  });

  it('lanza AppError 409 cuando ya existe un lead con ese RUC', async () => {
    dbMock.lead.findFirst.mockResolvedValue({ id: 'existing-lead', businessName: 'Duplicado' });

    await expect(
      createLeadAction({ ...VALID_CREATE_INPUT, ruc: '20123456789' }),
    ).rejects.toMatchObject({ status: 409, code: 'LEAD_DUPLICATE_RUC' });
  });

  it('lanza AppError 403 si un VENDEDOR intenta asignar owner al crear lead', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());

    await expect(
      createLeadAction({ ...VALID_CREATE_INPUT, ownerId: OWNER_ID }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('updateLeadAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID, ownerId: null });
    dbMock.lead.update.mockResolvedValue({ id: LEAD_ID });
  });

  it('lanza AppError 404 cuando el lead no existe en el tenant', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(updateLeadAction(VALID_UPDATE_INPUT)).rejects.toMatchObject({ status: 404 });
  });

  it('lanza AppError 403 cuando un PASANTE intenta editar un lead ajeno', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue({
      session: { user: { id: 'pasante-1', isSuperAdmin: false } },
      tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
      membership: { id: 'mem-p', role: 'PASANTE', isActive: true },
    });
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID, ownerId: 'otro-owner' });

    await expect(updateLeadAction(VALID_UPDATE_INPUT)).rejects.toMatchObject({ status: 403 });
  });

  it('actualiza el lead y retorna success cuando el usuario tiene permiso', async () => {
    const result = await updateLeadAction(VALID_UPDATE_INPUT);

    expect(result).toEqual({ success: true });
    expect(dbMock.lead.update).toHaveBeenCalled();
  });
});

describe('archiveLeadAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID, ownerId: null });
    dbMock.lead.update.mockResolvedValue({ id: LEAD_ID });
  });

  it('lanza AppError 404 cuando el lead no existe', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(
      archiveLeadAction({ tenantSlug: TENANT_SLUG, leadId: 'nonexistent' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('archiva el lead cuando el SUPERVISOR tiene permiso', async () => {
    const result = await archiveLeadAction({ tenantSlug: TENANT_SLUG, leadId: LEAD_ID });

    expect(result).toEqual({ success: true });
    expect(dbMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LEAD_ID },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('lanza AppError 403 cuando un PASANTE intenta archivar un lead ajeno', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue({
      session: { user: { id: 'p-1', isSuperAdmin: false } },
      tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
      membership: { id: 'mem-p', role: 'PASANTE', isActive: true },
    });
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID, ownerId: 'otro-owner' });

    await expect(
      archiveLeadAction({ tenantSlug: TENANT_SLUG, leadId: LEAD_ID }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('assignLeadAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.membership.findUnique.mockResolvedValue(makeOwnerMembership());
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
    dbMock.lead.update.mockResolvedValue({ id: LEAD_ID });
  });

  it('lanza AppError 403 cuando la feature ASSIGNMENTS está deshabilitada', async () => {
    assertTenantFeatureByIdMock
      .mockResolvedValueOnce(undefined) // CRM_LEADS OK
      .mockRejectedValueOnce(new Error('Feature ASSIGNMENTS disabled'));

    await expect(
      assignLeadAction({ tenantSlug: TENANT_SLUG, leadId: LEAD_ID, ownerId: OWNER_ID }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 403 cuando un VENDEDOR intenta asignar (sin permiso)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());

    await expect(
      assignLeadAction({ tenantSlug: TENANT_SLUG, leadId: LEAD_ID, ownerId: OWNER_ID }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('asigna el lead correctamente cuando SUPERVISOR tiene permisos', async () => {
    const result = await assignLeadAction({
      tenantSlug: TENANT_SLUG,
      leadId: LEAD_ID,
      ownerId: OWNER_ID,
    });

    expect(result).toEqual({ success: true });
    expect(dbMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LEAD_ID },
        data: { ownerId: OWNER_ID },
      }),
    );
  });
});

describe('bulkAssignLeadsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.membership.findUnique.mockResolvedValue(makeOwnerMembership());
    dbMock.lead.updateMany.mockResolvedValue({ count: 3 });
  });

  it('lanza AppError 403 cuando el usuario no tiene permiso de asignación masiva', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());

    await expect(
      bulkAssignLeadsAction({
        tenantSlug: TENANT_SLUG,
        leadIds: ['lead-1', 'lead-2'],
        ownerId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('asigna múltiples leads y retorna el conteo actualizado', async () => {
    const result = await bulkAssignLeadsAction({
      tenantSlug: TENANT_SLUG,
      leadIds: ['lead-1', 'lead-2', 'lead-3'],
      ownerId: OWNER_ID,
    });

    expect(result).toEqual({ success: true, updatedCount: 3 });
    expect(dbMock.lead.updateMany).toHaveBeenCalled();
  });
});

describe('requestLeadReassignmentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    // Lead con owner distinto al usuario (para que canEditLead retorne false)
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID, ownerId: 'otro-owner' });
    dbMock.leadReassignmentRequest.findFirst.mockResolvedValue(null);
    dbMock.membership.findUnique.mockResolvedValue(null); // para assertOwnerBelongsToTenant cuando requestedOwnerId
    dbMock.leadReassignmentRequest.create.mockResolvedValue({ id: 'req-1' });
  });

  it('lanza AppError 404 cuando el lead no existe', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(
      requestLeadReassignmentAction({
        tenantSlug: TENANT_SLUG,
        leadId: 'nonexistent',
        reason: 'Lo necesito',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('lanza AppError 409 cuando ya existe una solicitud PENDING para el lead', async () => {
    dbMock.leadReassignmentRequest.findFirst.mockResolvedValue({ id: 'existing-req' });

    await expect(
      requestLeadReassignmentAction({
        tenantSlug: TENANT_SLUG,
        leadId: LEAD_ID,
        reason: 'Segunda solicitud',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('crea la solicitud de reasignación correctamente', async () => {
    const result = await requestLeadReassignmentAction({
      tenantSlug: TENANT_SLUG,
      leadId: LEAD_ID,
      reason: 'El cliente solicitó cambio de ejecutivo',
    });

    expect(result).toEqual({ success: true, requestId: 'req-1' });
    expect(dbMock.leadReassignmentRequest.create).toHaveBeenCalled();
  });
});

describe('resolveLeadReassignmentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.leadReassignmentRequest.findFirst.mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
      requestedOwnerId: OWNER_ID,
      lead: { id: LEAD_ID, ownerId: 'old-owner' },
    });
    dbMock.membership.findUnique.mockResolvedValue(makeOwnerMembership());
    dbMock.$transaction.mockImplementation(async (fn: (tx: typeof dbMock) => Promise<unknown>) =>
      fn(dbMock),
    );
    dbMock.leadReassignmentRequest.update.mockResolvedValue({});
    dbMock.lead.update.mockResolvedValue({});
  });

  it('lanza AppError 403 cuando un VENDEDOR intenta resolver (sin permiso)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());

    await expect(
      resolveLeadReassignmentAction({
        tenantSlug: TENANT_SLUG,
        requestId: 'req-1',
        status: 'APPROVED',
        ownerId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 404 cuando la solicitud no existe', async () => {
    dbMock.leadReassignmentRequest.findFirst.mockResolvedValue(null);

    await expect(
      resolveLeadReassignmentAction({
        tenantSlug: TENANT_SLUG,
        requestId: 'nonexistent',
        status: 'APPROVED',
        ownerId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('lanza AppError 400 cuando la solicitud ya fue resuelta', async () => {
    dbMock.leadReassignmentRequest.findFirst.mockResolvedValue({
      id: 'req-1',
      status: 'APPROVED',
      requestedOwnerId: OWNER_ID,
      lead: { id: LEAD_ID, ownerId: 'old-owner' },
    });

    await expect(
      resolveLeadReassignmentAction({
        tenantSlug: TENANT_SLUG,
        requestId: 'req-1',
        status: 'APPROVED',
        ownerId: OWNER_ID,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('aprueba la solicitud, actualiza el lead y llama a revalidatePath', async () => {
    const result = await resolveLeadReassignmentAction({
      tenantSlug: TENANT_SLUG,
      requestId: 'req-1',
      status: 'APPROVED',
      ownerId: OWNER_ID,
    });

    expect(result).toEqual({ success: true });
    expect(dbMock.$transaction).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads`);
  });

  it('rechaza la solicitud sin seleccionar nuevo owner', async () => {
    const result = await resolveLeadReassignmentAction({
      tenantSlug: TENANT_SLUG,
      requestId: 'req-1',
      status: 'REJECTED',
    });

    expect(result).toEqual({ success: true });
  });
});
