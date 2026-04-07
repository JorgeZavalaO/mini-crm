import { put } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDocument(document: {
  id: string;
  name: string;
  blobUrl: string;
  blobPathname: string;
  mimeType: string;
}) {
  const response = await fetch(document.blobUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar el blob origen (${response.status}) para ${document.id}`);
  }

  const body = response.body ?? Buffer.from(await response.arrayBuffer());
  const blob = await put(document.blobPathname, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: document.mimeType,
  });

  await prisma.document.update({
    where: { id: document.id },
    data: {
      blobUrl: blob.url,
      blobPathname: blob.pathname,
    },
  });
}

async function main() {
  const documents = await prisma.document.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      blobUrl: true,
      blobPathname: true,
      mimeType: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (documents.length === 0) {
    console.log('No hay documentos activos para migrar.');
    return;
  }

  for (const document of documents) {
    console.log(`Migrando ${document.id} -> ${document.blobPathname}`);
    await migrateDocument(document);
  }

  console.log(`Migracion completada. Documentos procesados: ${documents.length}`);
}

main()
  .catch((error) => {
    console.error('Fallo la migracion de documentos privados:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
