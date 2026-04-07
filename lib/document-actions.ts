'use server';

import { del, put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { getTenantActionContextBySlug, assertTenantFeatureById } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { getPaginationState } from '@/lib/pagination';
import { canDeleteDocument, canUploadDocument } from '@/lib/lead-permissions';
import {
  deleteDocumentSchema,
  documentFiltersSchema,
  uploadDocumentSchema,
} from '@/lib/validators';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

type DocumentActorContext = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string | null;
  isSuperAdmin: boolean;
  isActiveMember: boolean;
};

function toDocumentActorContext(
  ctx: Awaited<ReturnType<typeof getTenantActionContextBySlug>>,
): DocumentActorContext {
  return {
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    userId: ctx.session.user.id,
    role: ctx.membership?.role ?? null,
    isSuperAdmin: ctx.session.user.isSuperAdmin,
    isActiveMember: ctx.session.user.isSuperAdmin || Boolean(ctx.membership?.isActive),
  };
}

async function getDocumentContext(tenantSlug: string): Promise<DocumentActorContext> {
  const ctx = await getTenantActionContextBySlug(tenantSlug);
  try {
    await assertTenantFeatureById(ctx.tenant.id, 'DOCUMENTS');
  } catch {
    throw new AppError('Módulo de documentos no habilitado para este tenant', 403);
  }
  return toDocumentActorContext(ctx);
}

function revalidateDocumentViews(tenantSlug: string, leadId?: string | null) {
  revalidatePath(`/${tenantSlug}/documents`);
  if (leadId) {
    revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  }
}

function getNormalizedFileExtension(filename: string) {
  const extensionIndex = filename.lastIndexOf('.');
  if (extensionIndex === -1) return null;

  return filename.slice(extensionIndex).toLowerCase();
}

function assertAllowedDocumentExtension(filename: string, mimeType: string) {
  const fileExtension = getNormalizedFileExtension(filename);
  const allowedExtensions = ALLOWED_EXTENSIONS_BY_MIME[mimeType];

  if (!fileExtension || !allowedExtensions?.includes(fileExtension)) {
    throw new AppError(
      'La extensión del archivo no coincide con el tipo permitido. Verifica el formato antes de subirlo.',
      400,
    );
  }
}

function buildDocumentDownloadUrl(documentId: string) {
  return `/api/documents/${documentId}`;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadDocumentAction(formData: FormData) {
  const raw = {
    tenantSlug: formData.get('tenantSlug'),
    leadId: formData.get('leadId') ?? undefined,
  };

  const parsed = uploadDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }
  const { tenantSlug, leadId } = parsed.data;

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new AppError('No se recibió ningún archivo', 400);
  }
  if (file.size === 0) {
    throw new AppError('El archivo está vacío', 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('El archivo supera el límite de 5 MB', 400);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new AppError(
      'Tipo de archivo no permitido. Usa PDF, Word, Excel o imágenes (JPEG, PNG, WEBP, GIF)',
      400,
    );
  }
  assertAllowedDocumentExtension(file.name, file.type);

  const ctx = await getDocumentContext(tenantSlug);

  if (!canUploadDocument(ctx)) {
    throw new AppError('No autorizado para subir documentos', 403);
  }

  if (leadId) {
    const lead = await db.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) {
      throw new AppError('Lead no encontrado', 404);
    }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathname = `${ctx.tenantId}/${leadId ?? 'general'}/${Date.now()}_${safeName}`;

  const blob = await put(pathname, file, {
    access: 'private',
    contentType: file.type,
    addRandomSuffix: false,
  });

  await db.document.create({
    data: {
      tenantId: ctx.tenantId,
      leadId: leadId ?? null,
      uploadedById: ctx.userId,
      name: file.name,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      mimeType: file.type,
      sizeBytes: file.size,
    },
  });

  revalidateDocumentViews(tenantSlug, leadId);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDocumentAction(input: unknown) {
  const parsed = deleteDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Datos inválidos', 400);
  }
  const { tenantSlug, documentId } = parsed.data;

  const ctx = await getDocumentContext(tenantSlug);

  const doc = await db.document.findFirst({
    where: { id: documentId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, uploadedById: true, blobPathname: true, leadId: true },
  });
  if (!doc) {
    throw new AppError('Documento no encontrado', 404);
  }

  if (!canDeleteDocument(ctx, doc.uploadedById)) {
    throw new AppError('No autorizado para eliminar este documento', 403);
  }

  await db.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

  try {
    await del(doc.blobPathname);
  } catch {
    // blob already gone – ignore
  }

  revalidateDocumentViews(tenantSlug, doc.leadId);
}

// ── List: lead ────────────────────────────────────────────────────────────────

export type DocumentRow = {
  id: string;
  name: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedById: string;
  uploadedBy: { name: string | null; email: string };
  leadId: string | null;
  leadName: string | null;
};

export async function listLeadDocumentsAction(
  leadId: string,
  tenantSlug: string,
): Promise<DocumentRow[]> {
  const ctx = await getDocumentContext(tenantSlug);

  const docs = await db.document.findMany({
    where: { leadId, tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      leadId: true,
      uploadedById: true,
      uploadedBy: { select: { name: true, email: true } },
    },
  });

  return docs.map((d) => ({
    ...d,
    downloadUrl: buildDocumentDownloadUrl(d.id),
    leadName: null,
  }));
}

export async function listLeadDocumentsPageAction(input: unknown): Promise<{
  docs: DocumentRow[];
  total: number;
}> {
  const parsed = documentFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Filtros inválidos', 400);
  }

  const { tenantSlug, leadId, page, pageSize } = parsed.data;
  if (!leadId) {
    throw new AppError('Lead requerido para listar documentos', 400);
  }

  const ctx = await getDocumentContext(tenantSlug);
  const where = {
    leadId,
    tenantId: ctx.tenantId,
    deletedAt: null as Date | null,
  };

  const total = await db.document.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const docs = await db.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      leadId: true,
      uploadedById: true,
      uploadedBy: { select: { name: true, email: true } },
    },
  });

  return {
    docs: docs.map((d) => ({
      ...d,
      downloadUrl: buildDocumentDownloadUrl(d.id),
      leadName: null,
    })),
    total,
  };
}

// ── List: tenant ──────────────────────────────────────────────────────────────

export async function listTenantDocumentsAction(
  tenantSlug: string,
  page = 1,
  pageSize = 20,
): Promise<{ docs: DocumentRow[]; total: number }> {
  const ctx = await getDocumentContext(tenantSlug);

  const where = { tenantId: ctx.tenantId, deletedAt: null as Date | null };

  const total = await db.document.count({ where });
  const pagination = getPaginationState({ totalItems: total, page, pageSize });

  const docs = await db.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pageSize,
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      leadId: true,
      uploadedById: true,
      uploadedBy: { select: { name: true, email: true } },
      lead: { select: { businessName: true } },
    },
  });

  return {
    docs: docs.map((d) => ({
      id: d.id,
      name: d.name,
      downloadUrl: buildDocumentDownloadUrl(d.id),
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
      leadId: d.leadId,
      leadName: d.lead?.businessName ?? null,
      uploadedById: d.uploadedById,
      uploadedBy: d.uploadedBy,
    })),
    total,
  };
}
