import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { AppError } from '@/lib/errors';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('@vercel/blob', () => ({
  get: getMock,
}));

const { getTenantActionContextByIdMock, assertTenantFeatureByIdMock } = vi.hoisted(() => ({
  getTenantActionContextByIdMock: vi.fn(),
  assertTenantFeatureByIdMock: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({
  getTenantActionContextById: getTenantActionContextByIdMock,
  assertTenantFeatureById: assertTenantFeatureByIdMock,
}));

const dbMock = vi.hoisted(() => ({
  document: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET } from '@/app/api/documents/[id]/route';

const TENANT_ID = 'tenant-1';
const DOC_ID = 'doc-1';

function createBlobStream() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'user-1', isSuperAdmin: false } });
  dbMock.document.findFirst.mockResolvedValue({
    id: DOC_ID,
    tenantId: TENANT_ID,
    name: 'contrato.pdf',
    mimeType: 'application/pdf',
    blobPathname: 'tenant-1/general/contrato.pdf',
  });
  getTenantActionContextByIdMock.mockResolvedValue({
    session: { user: { id: 'user-1', isSuperAdmin: false } },
    tenant: { id: TENANT_ID, slug: 'acme', name: 'Acme', isActive: true },
    membership: { id: 'mem-1', role: 'ADMIN', isActive: true },
  });
  assertTenantFeatureByIdMock.mockResolvedValue(undefined);
  getMock.mockResolvedValue({
    statusCode: 200,
    stream: createBlobStream(),
    headers: new Headers(),
    blob: {
      url: 'https://blob.test/private.pdf',
      downloadUrl: 'https://blob.test/download/private.pdf',
      pathname: 'tenant-1/general/contrato.pdf',
      contentDisposition: 'inline',
      cacheControl: 'private',
      uploadedAt: new Date('2026-01-01'),
      etag: 'etag-1',
      contentType: 'application/pdf',
      size: 3,
    },
  });
});

describe('document download route', () => {
  it('sirve el documento con headers privados y seguros', async () => {
    const request = new NextRequest('http://localhost/api/documents/doc-1?download=1');
    const response = await GET(request, { params: Promise.resolve({ id: DOC_ID }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('etag')).toBe('etag-1');
    expect(response.headers.get('content-disposition')).toContain('attachment;');
    expect(getMock).toHaveBeenCalledWith('tenant-1/general/contrato.pdf', {
      access: 'private',
      ifNoneMatch: undefined,
    });
  });

  it('devuelve 403 cuando el usuario no puede acceder al tenant del documento', async () => {
    getTenantActionContextByIdMock.mockRejectedValue(new AppError('No autorizado', 403));

    const request = new NextRequest('http://localhost/api/documents/doc-1');
    const response = await GET(request, { params: Promise.resolve({ id: DOC_ID }) });

    expect(response.status).toBe(403);
  });
});
