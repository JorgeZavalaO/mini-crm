import { get } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTenantActionContextById, assertTenantFeatureById } from '@/lib/auth-guard';
import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';

function buildContentDisposition(filename: string, download: boolean) {
  const dispositionType = download ? 'attachment' : 'inline';
  const fallbackFilename = filename.replace(/["\\]/g, '_');
  const encodedFilename = encodeURIComponent(filename);

  return `${dispositionType}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function buildBlobHeaders(params: {
  contentType: string;
  etag: string;
  filename: string;
  download: boolean;
}) {
  const headers = new Headers();

  headers.set('Content-Type', params.contentType);
  headers.set('ETag', params.etag);
  headers.set('Content-Disposition', buildContentDisposition(params.filename, params.download));
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');

  return headers;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: 'No se pudo descargar el documento' }, { status: 500 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const download = request.nextUrl.searchParams.get('download') === '1';
    const ifNoneMatch = request.headers.get('if-none-match') ?? undefined;

    // Verify authentication before any DB query to prevent document ID enumeration
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const document = await db.document.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        name: true,
        mimeType: true,
        blobPathname: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const ctx = await getTenantActionContextById(document.tenantId);

    try {
      await assertTenantFeatureById(ctx.tenant.id, 'DOCUMENTS');
    } catch {
      throw new AppError('Modulo de documentos no habilitado para este tenant', 403);
    }

    const blob = await get(document.blobPathname, {
      access: 'private',
      ifNoneMatch,
    });

    if (!blob) {
      return NextResponse.json({ error: 'Blob no encontrado' }, { status: 404 });
    }

    const headers = buildBlobHeaders({
      contentType: blob.blob.contentType ?? document.mimeType,
      etag: blob.blob.etag,
      filename: document.name,
      download,
    });

    if (blob.statusCode === 304) {
      return new NextResponse(null, { status: 304, headers });
    }

    return new NextResponse(blob.stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
