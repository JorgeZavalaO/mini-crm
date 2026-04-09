'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Upload, Trash2, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadCompanyLogoAction, removeCompanyLogoAction } from '@/lib/company-actions';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;

interface CompanyLogoUploadProps {
  tenantSlug: string;
  currentLogoUrl: string | null;
}

export function CompanyLogoUpload({ tenantSlug, currentLogoUrl }: CompanyLogoUploadProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error('Solo se aceptan imágenes JPEG, PNG o WEBP');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error('El logo no puede superar los 2 MB');
      e.target.value = '';
      return;
    }

    const fd = new FormData();
    fd.append('logo', file);

    startTransition(async () => {
      try {
        const result = await uploadCompanyLogoAction(tenantSlug, fd);
        setLogoUrl(result.logoUrl);
        toast.success('Logo actualizado correctamente');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al subir el logo');
      } finally {
        e.target.value = '';
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeCompanyLogoAction(tenantSlug);
        setLogoUrl(null);
        toast.success('Logo eliminado');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al eliminar el logo');
      }
    });
  }

  return (
    <div className="space-y-3">
      <Label>Logo de empresa</Label>

      {/* Preview */}
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border bg-muted">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt="Logo de empresa"
            width={112}
            height={112}
            className="h-full w-full object-contain"
            unoptimized
          />
        ) : (
          <ImageOff className="size-8 text-muted-foreground" />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={isPending}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 size-4" />
          {logoUrl ? 'Cambiar logo' : 'Subir logo'}
        </Button>

        {logoUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleRemove}
          >
            <Trash2 className="mr-2 size-4" />
            Eliminar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Formatos aceptados: JPEG, PNG, WEBP. Tamaño máximo: 2 MB.
      </p>
    </div>
  );
}
