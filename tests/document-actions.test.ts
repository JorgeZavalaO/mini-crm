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

const { putMock, delMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({ put: putMock, del: delMock }));

const dbMock = vi.hoisted(() => ({
  document: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  lead: { findFirst: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

import {
  uploadDocumentAction,
  deleteDocumentAction,
  listLeadDocumentsAction,
} from '@/lib/document-actions';

const TENANT_ID = 'tenant-abc';
const TENANT_SLUG = 'acme';
const LEAD_ID = 'lead-1';
const USER_ID = 'user-1';
const DOC_ID = 'doc-1';

function makeContext(role = 'VENDEDOR', isActive = true, isSuperAdmin = false) {
  return {
    session: { user: { id: USER_ID, isSuperAdmin } },
    tenant: { id: TENANT_ID, name: 'Acme', slug: TENANT_SLUG, isActive: true },
    membership: { id: 'mem-1', role, isActive },
  };
}

function makePdfFile(sizeBytes = 1000): File {
  const buffer = new Uint8Array(sizeBytes);
  return new File([buffer], 'test.pdf', { type: 'application/pdf' });
}

function makeFormData(overrides: Record<string, string | File | null> = {}): FormData {
  const fd = new FormData();
  fd.append('tenantSlug', TENANT_SLUG);
  fd.append('file', makePdfFile());
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) continue;
    fd.append(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getTenantActionContextBySlugMock.mockResolvedValue(makeContext());
  assertTenantFeatureByIdMock.mockResolvedValue(undefined);
  putMock.mockResolvedValue({
    url: 'https://blob.test/file.pdf',
    pathname: 'tenant-abc/general/123_test.pdf',
  });
  dbMock.document.create.mockResolvedValue({ id: DOC_ID });
  dbMock.lead.findFirst.mockResolvedValue({ id: LEAD_ID });
});

// ── uploadDocumentAction ──────────────────────────────────────────────────────

describe('uploadDocumentAction', () => {
  it('sube un PDF válido y crea registro en DB', async () => {
    const fd = makeFormData();
    await uploadDocumentAction(fd);

    expect(putMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(File),
      expect.objectContaining({
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/pdf',
      }),
    );
    expect(dbMock.document.create).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/documents`);
  });

  it('sube con leadId y revalida también la ruta del lead', async () => {
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append('leadId', LEAD_ID);
    fd.append('file', makePdfFile());
    await uploadDocumentAction(fd);

    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/documents`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/leads/${LEAD_ID}`);
  });

  it('lanza error si el archivo supera 5 MB', async () => {
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append('file', bigFile);

    await expect(uploadDocumentAction(fd)).rejects.toThrow('5 MB');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('lanza error si el tipo MIME no está permitido', async () => {
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append('file', new File(['data'], 'virus.exe', { type: 'application/octet-stream' }));

    await expect(uploadDocumentAction(fd)).rejects.toThrow('Tipo de archivo no permitido');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('lanza error si la extension no coincide con el MIME permitido', async () => {
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append('file', new File(['data'], 'archivo.pdf', { type: 'image/png' }));

    await expect(uploadDocumentAction(fd)).rejects.toThrow('archivo no coincide');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('lanza error si el archivo está vacío', async () => {
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append('file', new File([], 'empty.pdf', { type: 'application/pdf' }));

    await expect(uploadDocumentAction(fd)).rejects.toThrow('vacío');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('lanza 403 si el miembro está inactivo', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeContext('VENDEDOR', false));
    await expect(uploadDocumentAction(makeFormData())).rejects.toThrow('No autorizado');
  });

  it('PASANTE activo sí puede subir documentos', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeContext('PASANTE', true));
    await expect(uploadDocumentAction(makeFormData())).resolves.not.toThrow();
    expect(putMock).toHaveBeenCalledOnce();
  });

  it('lanza 404 si el leadId no existe en el tenant', async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append('leadId', 'nonexistent');
    fd.append('file', makePdfFile());

    await expect(uploadDocumentAction(fd)).rejects.toThrow('Lead no encontrado');
    expect(putMock).not.toHaveBeenCalled();
  });

  it('acepta imágenes JPEG', async () => {
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append('file', new File([new Uint8Array(500)], 'photo.jpg', { type: 'image/jpeg' }));
    await uploadDocumentAction(fd);
    expect(putMock).toHaveBeenCalledOnce();
  });

  it('acepta Excel (.xlsx)', async () => {
    const fd = new FormData();
    fd.append('tenantSlug', TENANT_SLUG);
    fd.append(
      'file',
      new File([new Uint8Array(500)], 'data.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    await uploadDocumentAction(fd);
    expect(putMock).toHaveBeenCalledOnce();
  });
});

// ── deleteDocumentAction ──────────────────────────────────────────────────────

describe('deleteDocumentAction', () => {
  const existingDoc = {
    id: DOC_ID,
    uploadedById: USER_ID,
    blobPathname: 'tenant-abc/general/123_test.pdf',
    leadId: null,
  };

  beforeEach(() => {
    dbMock.document.findFirst.mockResolvedValue(existingDoc);
    dbMock.document.update.mockResolvedValue({ id: DOC_ID });
    delMock.mockResolvedValue(undefined);
  });

  it('elimina documento propio (soft delete + del blob)', async () => {
    await deleteDocumentAction({ tenantSlug: TENANT_SLUG, documentId: DOC_ID });

    expect(dbMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOC_ID } }),
    );
    expect(delMock).toHaveBeenCalledWith(existingDoc.blobPathname);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/${TENANT_SLUG}/documents`);
  });

  it('SUPERVISOR puede eliminar documento ajeno', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeContext('SUPERVISOR', true));
    dbMock.document.findFirst.mockResolvedValue({ ...existingDoc, uploadedById: 'other-user' });

    await expect(
      deleteDocumentAction({ tenantSlug: TENANT_SLUG, documentId: DOC_ID }),
    ).resolves.not.toThrow();
    expect(dbMock.document.update).toHaveBeenCalledOnce();
  });

  it('VENDEDOR no puede eliminar documento ajeno', async () => {
    getTenantActionContextBySlugMock.mockResolvedValue(makeContext('VENDEDOR', true));
    dbMock.document.findFirst.mockResolvedValue({ ...existingDoc, uploadedById: 'other-user' });

    await expect(
      deleteDocumentAction({ tenantSlug: TENANT_SLUG, documentId: DOC_ID }),
    ).rejects.toThrow('No autorizado');
    expect(dbMock.document.update).not.toHaveBeenCalled();
  });

  it('lanza 404 si el documento no existe o ya fue eliminado', async () => {
    dbMock.document.findFirst.mockResolvedValue(null);
    await expect(
      deleteDocumentAction({ tenantSlug: TENANT_SLUG, documentId: 'ghost' }),
    ).rejects.toThrow('no encontrado');
  });

  it('no propaga error si el blob ya fue eliminado (del falla)', async () => {
    delMock.mockRejectedValue(new Error('blob not found'));
    await expect(
      deleteDocumentAction({ tenantSlug: TENANT_SLUG, documentId: DOC_ID }),
    ).resolves.not.toThrow();
    expect(dbMock.document.update).toHaveBeenCalledOnce();
  });
});

// ── listLeadDocumentsAction ───────────────────────────────────────────────────

describe('listLeadDocumentsAction', () => {
  it('retorna lista de documentos del lead', async () => {
    dbMock.document.findMany.mockResolvedValue([
      {
        id: DOC_ID,
        name: 'contrato.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        createdAt: new Date('2026-01-01'),
        leadId: LEAD_ID,
        uploadedById: USER_ID,
        uploadedBy: { name: 'Jorge', email: 'jorge@acme.com' },
      },
    ]);

    const result = await listLeadDocumentsAction(LEAD_ID, TENANT_SLUG);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('contrato.pdf');
    expect(result[0].downloadUrl).toBe(`/api/documents/${DOC_ID}`);
    expect(result[0].leadName).toBeNull();
  });

  it('retorna lista vacía si no hay documentos', async () => {
    dbMock.document.findMany.mockResolvedValue([]);
    const result = await listLeadDocumentsAction(LEAD_ID, TENANT_SLUG);
    expect(result).toHaveLength(0);
  });
});
