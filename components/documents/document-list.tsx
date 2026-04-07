'use client';

import { useState, useTransition } from 'react';
import { Download, FileText, ImageIcon, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { deleteDocumentAction, type DocumentRow } from '@/lib/document-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMimeLabel(mime: string): { label: string; icon: React.ReactNode } {
  if (mime === 'application/pdf')
    return { label: 'PDF', icon: <FileText className="size-4 text-red-500" /> };
  if (mime === 'application/msword' || mime.includes('wordprocessingml'))
    return { label: 'Word', icon: <FileText className="size-4 text-blue-500" /> };
  if (mime === 'application/vnd.ms-excel' || mime.includes('spreadsheetml'))
    return { label: 'Excel', icon: <FileText className="size-4 text-green-600" /> };
  if (mime.startsWith('image/'))
    return { label: 'Imagen', icon: <ImageIcon className="size-4 text-violet-500" /> };
  return { label: 'Archivo', icon: <FileText className="size-4 text-muted-foreground" /> };
}

function buildDocumentDownloadHref(downloadUrl: string) {
  return `${downloadUrl}?download=1`;
}

type Props = {
  docs: DocumentRow[];
  tenantSlug: string;
  currentUserId: string;
  currentRole: string | null;
  isSuperAdmin: boolean;
  showLeadColumn?: boolean;
};

export function DocumentList({
  docs,
  tenantSlug,
  currentUserId,
  currentRole,
  isSuperAdmin,
  showLeadColumn = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function canDelete(uploadedById: string) {
    if (isSuperAdmin) return true;
    if (currentUserId === uploadedById) return true;
    return currentRole === 'ADMIN' || currentRole === 'SUPERVISOR';
  }

  function handleDelete(documentId: string) {
    setDeletingId(documentId);
    setError(null);
    startTransition(async () => {
      try {
        await deleteDocumentAction({ tenantSlug, documentId });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar el documento');
      } finally {
        setDeletingId(null);
      }
    });
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
        <FileText className="size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No hay documentos todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Nombre</TableHead>
              {showLeadColumn && <TableHead>Lead</TableHead>}
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Tamaño</TableHead>
              <TableHead className="hidden lg:table-cell">Subido por</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => {
              const { label, icon } = getMimeLabel(doc.mimeType);
              const isDeleting = deletingId === doc.id && isPending;
              return (
                <TableRow key={doc.id} className={isDeleting ? 'opacity-50' : ''}>
                  <TableCell className="pr-0">{icon}</TableCell>
                  <TableCell className="max-w-45">
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {doc.name}
                    </a>
                  </TableCell>
                  {showLeadColumn && (
                    <TableCell>
                      {doc.leadName ? (
                        <Badge variant="secondary" className="max-w-35 truncate text-xs">
                          {doc.leadName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">General</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {formatBytes(doc.sizeBytes)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {doc.uploadedBy.name || doc.uploadedBy.email}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {formatDate(doc.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={isDeleting}
                          aria-label="Acciones del documento"
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <MoreHorizontal className="size-3.5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a
                            href={buildDocumentDownloadHref(doc.downloadUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="flex items-center gap-2"
                          >
                            <Download className="size-3.5" />
                            Descargar
                          </a>
                        </DropdownMenuItem>
                        {canDelete(doc.uploadedById) && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={isPending}
                            onSelect={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="size-3.5" />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
