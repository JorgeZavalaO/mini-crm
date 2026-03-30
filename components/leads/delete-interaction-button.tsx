'use client';

import type { InteractionType } from '@prisma/client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteInteractionAction } from '@/lib/interaction-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

const TYPE_LABEL: Record<InteractionType, string> = {
  CALL: 'llamada',
  EMAIL: 'email',
  NOTE: 'nota',
  VISIT: 'visita',
  WHATSAPP: 'WhatsApp',
};

type DeleteInteractionButtonProps = {
  tenantSlug: string;
  interactionId: string;
  type: InteractionType;
  subject: string | null;
};

export function DeleteInteractionButton({
  tenantSlug,
  interactionId,
  type,
  subject,
}: DeleteInteractionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      try {
        await deleteInteractionAction({ tenantSlug, interactionId });
        toast.success('Interacción eliminada');
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'No se pudo eliminar la interacción';
        toast.error(message);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          aria-label="Eliminar interacción"
          disabled={isPending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar interacción?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminará la {TYPE_LABEL[type]}
            {subject ? ` "${subject}"` : ''}. Esta acción es permanente y no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
