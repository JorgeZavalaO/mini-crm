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

export default function Error({
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
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle>Algo se desalineó</CardTitle>
          <CardDescription>
            Capturamos el error y dejamos una salida segura para que la app no explote con drama.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {getPublicErrorMessage(
              error,
              'Ocurrió un error inesperado mientras procesábamos la vista.',
            )}
          </p>
        </CardContent>
        <CardFooter>
          <Button type="button" className="w-full" onClick={() => reset()}>
            Reintentar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
