'use client';

import { useRef, useState, useTransition } from 'react';
import { FileText, ImageIcon, Loader2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDocumentAction } from '@/lib/document-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif';
const MAX_MB = 5;

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

const MIME_ICON: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="size-5 text-red-500" />,
  'application/msword': <FileText className="size-5 text-blue-500" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (
    <FileText className="size-5 text-blue-500" />
  ),
  'application/vnd.ms-excel': <FileText className="size-5 text-green-600" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (
    <FileText className="size-5 text-green-600" />
  ),
};

function getFileIcon(mimeType: string) {
  if (MIME_ICON[mimeType]) return MIME_ICON[mimeType];
  if (mimeType.startsWith('image/')) return <ImageIcon className="size-5 text-violet-500" />;
  return <FileText className="size-5 text-muted-foreground" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  tenantSlug: string;
  leadId?: string;
  onUploaded?: () => void;
};

export function DocumentUploadZone({ tenantSlug, leadId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validateAndSet(f: File) {
    setError(null);
    if (!ALLOWED_MIME_TYPES.has(f.type)) {
      setError(
        'Tipo de archivo no permitido. Usa PDF, Word, Excel o imágenes (JPEG, PNG, WEBP, GIF)',
      );
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera el límite de ${MAX_MB} MB`);
      return;
    }
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSet(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSet(f);
    e.target.value = '';
  }

  function handleUpload() {
    if (!file) return;
    const formData = new FormData();
    formData.append('tenantSlug', tenantSlug);
    formData.append('file', file);
    if (leadId) formData.append('leadId', leadId);

    startTransition(async () => {
      try {
        await uploadDocumentAction(formData);
        setFile(null);
        setError(null);
        toast.success('Documento subido correctamente');
        onUploaded?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al subir el archivo');
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de documentos"
        onClick={() => !file && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !file && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-30 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors',
          isDragging && 'animate-pulse border-primary bg-primary/5',
          file && !isDragging
            ? 'cursor-default border-green-400 bg-green-50 dark:bg-green-950/20'
            : !isDragging && 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          className="hidden"
          onChange={handleFileChange}
          disabled={isPending}
        />

        {file ? (
          <div className="flex w-full items-center justify-between gap-3 px-4 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {getFileIcon(file.type)}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setError(null);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <UploadCloud
              className={cn(
                'size-8 transition-colors',
                isDragging ? 'text-primary' : 'text-muted-foreground/50',
              )}
            />
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragging ? 'Suelta aquí' : 'Arrastra un archivo o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, Word, Excel, imágenes — máx {MAX_MB} MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload button */}
      {file && (
        <Button type="button" className="w-full gap-2" onClick={handleUpload} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Subiendo…
            </>
          ) : (
            <>
              <UploadCloud className="size-4" />
              Subir documento
            </>
          )}
        </Button>
      )}
    </div>
  );
}
