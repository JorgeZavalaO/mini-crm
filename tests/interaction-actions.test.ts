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
  interaction: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  createInteractionAction,
  deleteInteractionAction,
  updateInteractionAction,
} from '@/lib/interaction-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';
const LEAD_ID = 'lead-1';
const INTERACTION_ID = 'interaction-1';
const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

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

function makePasanteContext(userId = USER_ID) {
  return {
    ...makeSupervisorContext(userId),
    membership: { id: 'mem-1', role: 'PASANTE', isActive: true },
  };
}

function makeInactiveMemberContext(userId = USER_ID) {
  return {
    ...makeSupervisorContext(userId),
    membership: { id: 'mem-1', role: 'VENDEDOR', isActive: false },
  };
}

const VALID_CREATE_INPUT = {
  tenantSlug: TENANT_SLUG,
  leadId: LEAD_ID,
  type: 'CALL' as const,
  notes: 'Llamada de contacto inicial',
  occurredAt: new Date('2026-03-30T10:00:00Z'),
};

const VALID_UPDATE_INPUT = {
  tenantSlug: TENANT_SLUG,
  leadId: LEAD_ID,
  interactionId: INTERACTION_ID,
  type: 'EMAIL' as const,
  notes: 'Enviado email de seguimiento',
  occurredAt: new Date('2026-03-30T11:00:00Z'),
};

const VALID_DELETE_INPUT = {
  tenantSlug: TENANT_SLUG,
  interactionId: INTERACTION_ID,
};

// ────────────────────────────────────────────────────────────────
// createInteractionAction
// ────────────────────────────────────────────────────────────────

describe('createInteractionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
    dbMock.interaction.create.mockResolvedValue({ id: INTERACTION_ID });
  });

  it('lanza AppError 400 cuando faltan campos requeridos', async () => {
    await expect(createInteractionAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 400 cuando notes está vacío', async () => {
    await expect(
      createInteractionAction({ ...VALID_CREATE_INPUT, notes: '' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 403 cuando INTERACTIONS no está habilitado', async () => {
    assertTenantFeatureByIdMock.mockImplementation((tenantId: string, featureKey: string) => {
      if (featureKey === 'INTERACTIONS') throw new Error('Feature disabled');
      return Promise.resolve(undefined);
    });

    await expect(createInteractionAction(VALID_CREATE_INPUT)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('lanza AppError 403 cuando CRM_LEADS no está habilitado', async () => {
    assertTenantFeatureByIdMock.mockImplementation((tenantId: string, featureKey: string) => {
      if (featureKey === 'CRM_LEADS') throw new Error('Feature disabled');
      return Promise.resolve(undefined);
    });

    await expect(createInteractionAction(VALID_CREATE_INPUT)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('lanza AppError 403 cuando el miembro está inactivo', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeInactiveMemberContext());

    await expect(createInteractionAction(VALID_CREATE_INPUT)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('lanza AppError 404 cuando el lead no existe en el tenant', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(createInteractionAction(VALID_CREATE_INPUT)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('crea la interacción y retorna el interactionId', async () => {
    const result = await createInteractionAction(VALID_CREATE_INPUT);

    expect(result).toEqual({ success: true, interactionId: INTERACTION_ID });
    expect(dbMock.interaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: LEAD_ID,
          tenantId: TENANT_ID,
          authorId: USER_ID,
          type: 'CALL',
          notes: 'Llamada de contacto inicial',
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });

  it('permite a PASANTE registrar interacciones (cualquier miembro activo puede)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makePasanteContext());

    const result = await createInteractionAction(VALID_CREATE_INPUT);
    expect(result).toEqual({ success: true, interactionId: INTERACTION_ID });
  });

  it('crea interacción con asunto opcional', async () => {
    await createInteractionAction({ ...VALID_CREATE_INPUT, subject: 'Lllamada cierre Q1' });
    expect(dbMock.interaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subject: 'Lllamada cierre Q1' }),
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────────
// updateInteractionAction
// ────────────────────────────────────────────────────────────────

describe('updateInteractionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.interaction.findFirst.mockResolvedValue({
      id: INTERACTION_ID,
      leadId: LEAD_ID,
      authorId: USER_ID,
    });
    dbMock.interaction.update.mockResolvedValue({});
  });

  it('lanza AppError 400 con datos inválidos', async () => {
    await expect(updateInteractionAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 404 cuando la interacción no existe', async () => {
    dbMock.interaction.findFirst.mockResolvedValue(null);

    await expect(updateInteractionAction(VALID_UPDATE_INPUT)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lanza AppError 403 cuando un VENDEDOR intenta editar la interacción de otro usuario', async () => {
    dbMock.interaction.findFirst.mockResolvedValue({
      id: INTERACTION_ID,
      leadId: LEAD_ID,
      authorId: OTHER_USER_ID, // autor diferente
    });

    await expect(updateInteractionAction(VALID_UPDATE_INPUT)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('el autor puede editar su propia interacción', async () => {
    const result = await updateInteractionAction(VALID_UPDATE_INPUT);
    expect(result).toEqual({ success: true });
    expect(dbMock.interaction.update).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });

  it('un SUPERVISOR puede editar interacciones de otros', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    dbMock.interaction.findFirst.mockResolvedValue({
      id: INTERACTION_ID,
      leadId: LEAD_ID,
      authorId: OTHER_USER_ID,
    });

    const result = await updateInteractionAction(VALID_UPDATE_INPUT);
    expect(result).toEqual({ success: true });
  });
});

// ────────────────────────────────────────────────────────────────
// deleteInteractionAction
// ────────────────────────────────────────────────────────────────

describe('deleteInteractionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.interaction.findFirst.mockResolvedValue({
      id: INTERACTION_ID,
      leadId: LEAD_ID,
      authorId: USER_ID,
    });
    dbMock.interaction.delete.mockResolvedValue({});
  });

  it('lanza AppError 400 con datos inválidos', async () => {
    await expect(deleteInteractionAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 404 cuando la interacción no existe', async () => {
    dbMock.interaction.findFirst.mockResolvedValue(null);

    await expect(deleteInteractionAction(VALID_DELETE_INPUT)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lanza AppError 403 cuando un VENDEDOR intenta borrar la interacción de otro', async () => {
    dbMock.interaction.findFirst.mockResolvedValue({
      id: INTERACTION_ID,
      leadId: LEAD_ID,
      authorId: OTHER_USER_ID,
    });

    await expect(deleteInteractionAction(VALID_DELETE_INPUT)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('el autor puede eliminar su propia interacción', async () => {
    const result = await deleteInteractionAction(VALID_DELETE_INPUT);
    expect(result).toEqual({ success: true });
    expect(dbMock.interaction.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INTERACTION_ID } }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });

  it('un SUPERVISOR puede eliminar interacciones de otros', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    dbMock.interaction.findFirst.mockResolvedValue({
      id: INTERACTION_ID,
      leadId: LEAD_ID,
      authorId: OTHER_USER_ID,
    });

    const result = await deleteInteractionAction(VALID_DELETE_INPUT);
    expect(result).toEqual({ success: true });
  });

  it('lanza AppError 403 cuando INTERACTIONS no está habilitado', async () => {
    assertTenantFeatureByIdMock.mockImplementation((tenantId: string, featureKey: string) => {
      if (featureKey === 'INTERACTIONS') throw new Error('Feature disabled');
      return Promise.resolve(undefined);
    });

    await expect(deleteInteractionAction(VALID_DELETE_INPUT)).rejects.toMatchObject({
      status: 403,
    });
  });
});
