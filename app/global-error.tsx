'use client';

import { useEffect } from 'react';
import { getPublicErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>Fallo global controlado</CardTitle>
            <CardDescription>
              La aplicación interceptó un error crítico y te devuelve una salida segura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {getPublicErrorMessage(error, 'Se produjo un error global inesperado.')}
            </p>
          </CardContent>
          <CardFooter>
            <Button type="button" className="w-full" onClick={() => reset()}>
              Intentar recuperación
            </Button>
          </CardFooter>
        </Card>
      </body>
    </html>
  );
}
