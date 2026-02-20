import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-4xl font-bold">403</h1>
        <p className="text-lg font-medium">Acceso restringido</p>
        <p className="text-muted-foreground">
          El modulo solicitado no esta habilitado para este tenant o tu cuenta no tiene permisos.
        </p>
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
