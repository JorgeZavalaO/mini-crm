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
  task: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  lead: {
    findFirst: vi.fn(),
  },
  membership: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  changeTaskStatusAction,
  createTaskAction,
  deleteTaskAction,
  listLeadTasksAction,
  listTenantTasksAction,
  updateTaskAction,
} from '@/lib/task-actions';

const TENANT_ID = 'tenant-t1';
const TENANT_SLUG = 'acme';
const LEAD_ID = 'lead-1';
const TASK_ID = 'task-1';
const USER_ID = 'user-a';
const OTHER_USER_ID = 'user-b';

function makeAdminContext(userId = USER_ID) {
  return {
    session: { user: { id: userId, isSuperAdmin: false } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role: 'ADMIN', isActive: true },
  };
}

function makeSupervisorContext(userId = USER_ID) {
  return {
    ...makeAdminContext(userId),
    membership: { id: 'mem-1', role: 'SUPERVISOR', isActive: true },
  };
}

function makeVendedorContext(userId = USER_ID) {
  return {
    ...makeAdminContext(userId),
    membership: { id: 'mem-1', role: 'VENDEDOR', isActive: true },
  };
}

function makeInactiveMemberContext(userId = USER_ID) {
  return {
    ...makeAdminContext(userId),
    membership: { id: 'mem-1', role: 'VENDEDOR', isActive: false },
  };
}

function makeSuperAdminContext(userId = USER_ID) {
  return {
    session: { user: { id: userId, isSuperAdmin: true } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: null,
  };
}

const VALID_CREATE_INPUT = {
  tenantSlug: TENANT_SLUG,
  leadId: LEAD_ID,
  title: 'Hacer seguimiento',
  priority: 'MEDIUM' as const,
};

const VALID_UPDATE_INPUT = {
  tenantSlug: TENANT_SLUG,
  taskId: TASK_ID,
  leadId: LEAD_ID,
  title: 'Hacer seguimiento actualizado',
  priority: 'HIGH' as const,
};

const VALID_CHANGE_STATUS_INPUT = {
  tenantSlug: TENANT_SLUG,
  taskId: TASK_ID,
  status: 'IN_PROGRESS' as const,
};

const VALID_DELETE_INPUT = {
  tenantSlug: TENANT_SLUG,
  taskId: TASK_ID,
};

const CREATED_TASK = {
  id: TASK_ID,
  title: 'Hacer seguimiento',
  description: null,
  status: 'PENDING',
  priority: 'MEDIUM',
  dueDate: null,
  completedAt: null,
  createdAt: new Date(),
  leadId: LEAD_ID,
  createdById: USER_ID,
  assignedToId: null,
  lead: null,
  createdBy: { name: 'Alice' },
  assignedTo: null,
};

// ────────────────────────────────────────────────────────────────
// createTaskAction
// ────────────────────────────────────────────────────────────────

describe('createTaskAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
    dbMock.membership.findUnique.mockResolvedValue({ userId: USER_ID, isActive: true });
    dbMock.task.create.mockResolvedValue(CREATED_TASK);
  });

  it('lanza AppError 400 cuando faltan campos requeridos', async () => {
    await expect(createTaskAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 400 cuando el título está vacío', async () => {
    await expect(createTaskAction({ ...VALID_CREATE_INPUT, title: '' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('lanza AppError 403 cuando el miembro está inactivo', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeInactiveMemberContext());

    await expect(createTaskAction(VALID_CREATE_INPUT)).rejects.toMatchObject({ status: 403 });
  });

  it('lanza AppError 404 cuando el lead no pertenece al tenant', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(createTaskAction(VALID_CREATE_INPUT)).rejects.toMatchObject({ status: 404 });
  });

  it('crea la tarea y retorna taskId', async () => {
    const result = await createTaskAction(VALID_CREATE_INPUT);

    expect(result).toEqual({ success: true, taskId: TASK_ID });
    expect(dbMock.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          leadId: LEAD_ID,
          createdById: USER_ID,
          title: 'Hacer seguimiento',
          priority: 'MEDIUM',
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/tasks`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });

  it('crea tarea sin leadId cuando no se proporciona', async () => {
    const inputSinLead = {
      tenantSlug: TENANT_SLUG,
      title: 'Tarea sin lead',
      priority: 'LOW' as const,
    };
    const result = await createTaskAction(inputSinLead);

    expect(result).toEqual({ success: true, taskId: TASK_ID });
    expect(dbMock.lead.findFirst).not.toHaveBeenCalled();
  });

  it('permite crear tareas a un miembro PASANTE activo', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue({
      ...makeVendedorContext(),
      membership: { id: 'mem-1', role: 'PASANTE', isActive: true },
    });

    const result = await createTaskAction(VALID_CREATE_INPUT);
    expect(result).toEqual({ success: true, taskId: TASK_ID });
  });

  it('permite crear tareas a un superAdmin aunque no tenga membership', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSuperAdminContext());

    const result = await createTaskAction(VALID_CREATE_INPUT);
    expect(result).toEqual({ success: true, taskId: TASK_ID });
  });

  it('bloquea a un vendedor cuando intenta asignar la tarea a otro usuario', async () => {
    await expect(
      createTaskAction({
        ...VALID_CREATE_INPUT,
        assignedToId: OTHER_USER_ID,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rechaza asignar la tarea a un usuario sin membership activa', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    dbMock.membership.findUnique.mockResolvedValue({ userId: OTHER_USER_ID, isActive: false });

    await expect(
      createTaskAction({
        ...VALID_CREATE_INPUT,
        assignedToId: OTHER_USER_ID,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza asignar la tarea a un usuario que no es miembro del tenant', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    dbMock.membership.findUnique.mockResolvedValue(null);

    await expect(
      createTaskAction({
        ...VALID_CREATE_INPUT,
        assignedToId: OTHER_USER_ID,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ────────────────────────────────────────────────────────────────
// updateTaskAction
// ────────────────────────────────────────────────────────────────

describe('updateTaskAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      leadId: LEAD_ID,
      createdById: USER_ID,
      assignedToId: null,
    });
    dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
    dbMock.membership.findUnique.mockResolvedValue({ userId: USER_ID, isActive: true });
    dbMock.task.update.mockResolvedValue({
      ...CREATED_TASK,
      title: 'Hacer seguimiento actualizado',
    });
  });

  it('lanza AppError 400 cuando faltan campos requeridos', async () => {
    await expect(updateTaskAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 404 cuando la tarea no existe', async () => {
    dbMock.task.findFirst.mockResolvedValue(null);

    await expect(updateTaskAction(VALID_UPDATE_INPUT)).rejects.toMatchObject({ status: 404 });
  });

  it('lanza AppError 403 cuando un VENDEDOR que no es creator ni assignee intenta editar', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext(OTHER_USER_ID));
    dbMock.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      leadId: LEAD_ID,
      createdById: USER_ID,
      assignedToId: null,
    });

    await expect(updateTaskAction(VALID_UPDATE_INPUT)).rejects.toMatchObject({ status: 403 });
  });

  it('permite editar al VENDEDOR creador de la tarea', async () => {
    const result = await updateTaskAction(VALID_UPDATE_INPUT);

    expect(result).toEqual({ success: true });
    expect(dbMock.task.update).toHaveBeenCalled();
  });

  it('permite editar al SUPERVISOR aunque no sea creator ni assignee', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext(OTHER_USER_ID));

    const result = await updateTaskAction(VALID_UPDATE_INPUT);
    expect(result).toEqual({ success: true });
  });

  it('bloquea a un vendedor cuando intenta reasignar la tarea a otro usuario', async () => {
    await expect(
      updateTaskAction({
        ...VALID_UPDATE_INPUT,
        assignedToId: OTHER_USER_ID,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lanza 404 cuando el nuevo lead no pertenece al tenant', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);

    await expect(updateTaskAction(VALID_UPDATE_INPUT)).rejects.toMatchObject({ status: 404 });
  });

  it('rechaza asignar a un usuario que no es miembro del tenant', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());
    dbMock.membership.findUnique.mockResolvedValue(null);

    await expect(
      updateTaskAction({
        ...VALID_UPDATE_INPUT,
        assignedToId: OTHER_USER_ID,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('revalida el lead anterior y el nuevo cuando cambia la relación', async () => {
    dbMock.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      leadId: 'lead-previo',
      createdById: USER_ID,
      assignedToId: null,
    });

    await updateTaskAction(VALID_UPDATE_INPUT);

    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/lead-previo`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });
});

// ────────────────────────────────────────────────────────────────
// changeTaskStatusAction
// ────────────────────────────────────────────────────────────────

describe('changeTaskStatusAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      leadId: LEAD_ID,
      createdById: USER_ID,
      assignedToId: null,
    });
    dbMock.task.update.mockResolvedValue({ ...CREATED_TASK, status: 'IN_PROGRESS' });
  });

  it('lanza AppError 400 cuando faltan campos requeridos', async () => {
    await expect(changeTaskStatusAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 404 cuando la tarea no existe', async () => {
    dbMock.task.findFirst.mockResolvedValue(null);

    await expect(changeTaskStatusAction(VALID_CHANGE_STATUS_INPUT)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('lanza AppError 403 cuando un vendedor no relacionado intenta cambiar estado', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext(OTHER_USER_ID));

    await expect(changeTaskStatusAction(VALID_CHANGE_STATUS_INPUT)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('actualiza el estado correctamente', async () => {
    const result = await changeTaskStatusAction(VALID_CHANGE_STATUS_INPUT);

    expect(result).toEqual({ success: true });
    expect(dbMock.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );
  });

  it('asigna completedAt cuando el nuevo estado es DONE', async () => {
    dbMock.task.update.mockResolvedValue({
      ...CREATED_TASK,
      status: 'DONE',
      completedAt: new Date(),
    });

    await changeTaskStatusAction({ ...VALID_CHANGE_STATUS_INPUT, status: 'DONE' });

    expect(dbMock.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DONE',
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('pone completedAt a null cuando el estado no es DONE', async () => {
    await changeTaskStatusAction({ ...VALID_CHANGE_STATUS_INPUT, status: 'PENDING' });

    expect(dbMock.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          completedAt: null,
        }),
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────────
// deleteTaskAction
// ────────────────────────────────────────────────────────────────

describe('deleteTaskAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      leadId: LEAD_ID,
      createdById: USER_ID,
      assignedToId: null,
    });
    dbMock.task.update.mockResolvedValue({});
  });

  it('lanza AppError 400 cuando faltan campos requeridos', async () => {
    await expect(deleteTaskAction({})).rejects.toMatchObject({ status: 400 });
  });

  it('lanza AppError 404 cuando la tarea no existe', async () => {
    dbMock.task.findFirst.mockResolvedValue(null);

    await expect(deleteTaskAction(VALID_DELETE_INPUT)).rejects.toMatchObject({ status: 404 });
  });

  it('lanza AppError 403 cuando un vendedor no relacionado intenta eliminar', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext(OTHER_USER_ID));

    await expect(deleteTaskAction(VALID_DELETE_INPUT)).rejects.toMatchObject({ status: 403 });
  });

  it('elimina (soft) la tarea cuando es el creador', async () => {
    const result = await deleteTaskAction(VALID_DELETE_INPUT);

    expect(result).toEqual({ success: true });
    expect(dbMock.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TASK_ID, tenantId: TENANT_ID },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('permite eliminar al SUPERVISOR aunque no sea creator', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext(OTHER_USER_ID));

    const result = await deleteTaskAction(VALID_DELETE_INPUT);
    expect(result).toEqual({ success: true });
  });

  it('revalida rutas después de eliminar', async () => {
    await deleteTaskAction(VALID_DELETE_INPUT);

    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/tasks`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });
});

// ────────────────────────────────────────────────────────────────
// listLeadTasksAction
// ────────────────────────────────────────────────────────────────

describe('listLeadTasksAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.task.findMany.mockResolvedValue([
      {
        ...CREATED_TASK,
        lead: { businessName: 'Acme Corp' },
        createdBy: { name: 'Alice' },
        assignedTo: null,
      },
    ]);
  });

  it('retorna lista de tareas del lead mapeadas a TaskRow', async () => {
    const result = await listLeadTasksAction(LEAD_ID, TENANT_SLUG);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({
      id: TASK_ID,
      title: 'Hacer seguimiento',
      leadName: 'Acme Corp',
      createdById: USER_ID,
      createdByName: 'Alice',
    });
  });

  it('filtra por leadId en la query', async () => {
    await listLeadTasksAction(LEAD_ID, TENANT_SLUG);

    expect(dbMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leadId: LEAD_ID, tenantId: TENANT_ID }),
      }),
    );
  });

  it('agrega filtro OR para VENDEDOR (solo tareas propias)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());

    await listLeadTasksAction(LEAD_ID, TENANT_SLUG);

    expect(dbMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ createdById: USER_ID }, { assignedToId: USER_ID }],
        }),
      }),
    );
  });

  it('NO agrega filtro OR para SUPERVISOR (ve todas las tareas)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());

    await listLeadTasksAction(LEAD_ID, TENANT_SLUG);

    const call = dbMock.task.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });

  it('NO agrega filtro OR para ADMIN (ve todas las tareas)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeAdminContext());

    await listLeadTasksAction(LEAD_ID, TENANT_SLUG);

    const call = dbMock.task.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });

  it('NO agrega filtro OR para superAdmin (ve todas las tareas)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSuperAdminContext());

    await listLeadTasksAction(LEAD_ID, TENANT_SLUG);

    const call = dbMock.task.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });
});

// ────────────────────────────────────────────────────────────────
// listTenantTasksAction
// ────────────────────────────────────────────────────────────────

describe('listTenantTasksAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());
    assertTenantFeatureByIdMock.mockResolvedValue(undefined);
    dbMock.task.count.mockResolvedValue(1);
    dbMock.task.findMany.mockResolvedValue([
      {
        ...CREATED_TASK,
        lead: { businessName: 'Acme Corp' },
        createdBy: { name: 'Alice' },
        assignedTo: null,
      },
    ]);
  });

  it('lanza AppError 400 cuando los filtros son inválidos', async () => {
    await expect(listTenantTasksAction({ tenantSlug: 123 })).rejects.toMatchObject({ status: 400 });
  });

  it('retorna tareas y total correctamente', async () => {
    const result = await listTenantTasksAction({ tenantSlug: TENANT_SLUG });

    expect(result).toMatchObject({ total: 1 });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({ id: TASK_ID, leadName: 'Acme Corp' });
  });

  it('aplica filtro por assignedToId cuando se proporciona', async () => {
    await listTenantTasksAction({ tenantSlug: TENANT_SLUG, assignedToId: USER_ID });

    expect(dbMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedToId: USER_ID }),
      }),
    );
  });

  it('aplica filtro por status cuando se proporciona', async () => {
    await listTenantTasksAction({ tenantSlug: TENANT_SLUG, status: 'PENDING' });

    expect(dbMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
  });

  it('agrega filtro OR para VENDEDOR (solo tareas propias)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeVendedorContext());

    await listTenantTasksAction({ tenantSlug: TENANT_SLUG });

    expect(dbMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ createdById: USER_ID }, { assignedToId: USER_ID }],
        }),
      }),
    );
    expect(dbMock.task.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ createdById: USER_ID }, { assignedToId: USER_ID }],
        }),
      }),
    );
  });

  it('NO agrega filtro OR para SUPERVISOR', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSupervisorContext());

    await listTenantTasksAction({ tenantSlug: TENANT_SLUG });

    const call = dbMock.task.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });

  it('NO agrega filtro OR para ADMIN', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeAdminContext());

    await listTenantTasksAction({ tenantSlug: TENANT_SLUG });

    const call = dbMock.task.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });

  it('NO agrega filtro OR para superAdmin', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeSuperAdminContext());

    await listTenantTasksAction({ tenantSlug: TENANT_SLUG });

    const call = dbMock.task.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });

  it('agrega filtro OR para PASANTE (solo tareas propias)', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue({
      ...makeAdminContext(),
      membership: { id: 'mem-1', role: 'PASANTE', isActive: true },
    });

    await listTenantTasksAction({ tenantSlug: TENANT_SLUG });

    expect(dbMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ createdById: USER_ID }, { assignedToId: USER_ID }],
        }),
      }),
    );
  });
});
