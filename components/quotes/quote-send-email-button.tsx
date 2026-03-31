'use client';

import { useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { sendQuoteEmailAction } from '@/lib/quote-actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface QuoteSendEmailButtonProps {
  tenantSlug: string;
  quoteId: string;
  quoteNumber: string;
  defaultEmail?: string;
}

export function QuoteSendEmailButton({
  tenantSlug,
  quoteId,
  quoteNumber,
  defaultEmail = '',
}: QuoteSendEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    startTransition(async () => {
      try {
        await sendQuoteEmailAction({ tenantSlug, quoteId, recipientEmail: email });
        toast.success(`Cotización ${quoteNumber} enviada a ${email}`);
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al enviar el email');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="mr-1.5 size-3.5" />
          Enviar por email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enviar cotización por email</DialogTitle>
          <DialogDescription>
            Se enviará <strong>{quoteNumber}</strong> al destinatario indicado. Si la cotización
            está en Borrador, pasará automáticamente a Enviada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="recipient-email">Email del destinatario</Label>
          <Input
            id="recipient-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@empresa.com"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isPending || !email.trim()} className="min-w-24">
            {isPending ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
