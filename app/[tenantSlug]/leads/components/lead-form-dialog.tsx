'use client';

import { useState, useTransition, type ReactNode } from 'react';
import type { LeadStatus } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createLeadSafeAction, updateLeadSafeAction } from '@/lib/lead-actions';
import { parseDelimitedList } from '@/lib/lead-normalization';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'QUALIFIED', label: 'Calificado' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'WON', label: 'Ganado' },
];

type LeadOwnerOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  VENDEDOR: 'Vendedor',
  FREELANCE: 'Freelance',
  PASANTE: 'Pasante',
};

type EditableLead = {
  id: string;
  businessName: string;
  ruc: string | null;
  country: string | null;
  city: string | null;
  industry: string | null;
  source: string | null;
  notes: string | null;
  phones: string[];
  emails: string[];
  gerente: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: LeadStatus;
  ownerId: string | null;
};

interface LeadFormDialogProps {
  tenantSlug: string;
  owners: LeadOwnerOption[];
  canAssign: boolean;
  trigger: ReactNode;
  lead?: EditableLead;
  onSaved?: () => void;
}

const UNASSIGNED = '__UNASSIGNED__';

function RequiredMark() {
  return (
    <span className="ml-1 text-destructive" aria-label="obligatorio">
      *
    </span>
  );
}

function toFormDefaults(lead?: EditableLead) {
  return {
    businessName: lead?.businessName ?? '',
    ruc: lead?.ruc ?? '',
    country: lead?.country ?? '',
    city: lead?.city ?? '',
    industry: lead?.industry ?? '',
    source: lead?.source ?? '',
    notes: lead?.notes ?? '',
    phonesText: (lead?.phones ?? []).join('\n'),
    emailsText: (lead?.emails ?? []).join('\n'),
    gerente: lead?.gerente ?? '',
    contactName: lead?.contactName ?? '',
    contactPhone: lead?.contactPhone ?? '',
    status: (lead?.status ?? 'NEW') as LeadStatus,
    ownerValue: lead?.ownerId ?? UNASSIGNED,
  };
}

export function LeadFormDialog({
  tenantSlug,
  owners,
  canAssign,
  trigger,
  lead,
  onSaved,
}: LeadFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isEdit = Boolean(lead);
  const title = isEdit ? 'Editar lead' : 'Nuevo lead';
  const description = isEdit
    ? 'Actualiza la informacion del prospecto.'
    : 'Registra un nuevo prospecto para el equipo.';

  const defaults = toFormDefaults(lead);
  const [businessName, setBusinessName] = useState(defaults.businessName);
  const [ruc, setRuc] = useState(defaults.ruc);
  const [country, setCountry] = useState(defaults.country);
  const [city, setCity] = useState(defaults.city);
  const [industry, setIndustry] = useState(defaults.industry);
  const [source, setSource] = useState(defaults.source);
  const [notes, setNotes] = useState(defaults.notes);
  const [phonesText, setPhonesText] = useState(defaults.phonesText);
  const [emailsText, setEmailsText] = useState(defaults.emailsText);
  const [gerente, setGerente] = useState(defaults.gerente);
  const [contactName, setContactName] = useState(defaults.contactName);
  const [contactPhone, setContactPhone] = useState(defaults.contactPhone);
  const [status, setStatus] = useState<LeadStatus>(defaults.status);
  const [ownerValue, setOwnerValue] = useState(defaults.ownerValue);

  function resetForm() {
    const nextDefaults = toFormDefaults(lead);
    setBusinessName(nextDefaults.businessName);
    setRuc(nextDefaults.ruc);
    setCountry(nextDefaults.country);
    setCity(nextDefaults.city);
    setIndustry(nextDefaults.industry);
    setSource(nextDefaults.source);
    setNotes(nextDefaults.notes);
    setPhonesText(nextDefaults.phonesText);
    setEmailsText(nextDefaults.emailsText);
    setGerente(nextDefaults.gerente);
    setContactName(nextDefaults.contactName);
    setContactPhone(nextDefaults.contactPhone);
    setStatus(nextDefaults.status);
    setOwnerValue(nextDefaults.ownerValue);
  }

  function buildPayloadBase() {
    return {
      tenantSlug,
      businessName,
      ruc,
      country,
      city,
      industry,
      source,
      notes,
      phones: parseDelimitedList(phonesText),
      emails: parseDelimitedList(emailsText),
      gerente,
      contactName,
      contactPhone,
      status,
      ...(canAssign ? { ownerId: ownerValue === UNASSIGNED ? null : ownerValue } : {}),
    };
  }

  function onSubmit() {
    startTransition(async () => {
      try {
        if (isEdit && lead) {
          const result = await updateLeadSafeAction({
            ...buildPayloadBase(),
            leadId: lead.id,
          });
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success('Lead actualizado');
        } else {
          const result = await createLeadSafeAction(buildPayloadBase());
          if (!result.success) {
            toast.error(result.message);
            return;
          }
          toast.success('Lead creado');
        }
        setOpen(false);
        router.refresh();
        onSaved?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar el lead';
        toast.error(message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="space-y-2">
            <Label htmlFor={`${lead?.id ?? 'new'}-businessName`}>
              Razon social
              <RequiredMark />
            </Label>
            <Input
              id={`${lead?.id ?? 'new'}-businessName`}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Acme Logistics SAC"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-ruc`}>RUC</Label>
              <Input
                id={`${lead?.id ?? 'new'}-ruc`}
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                placeholder="20123456789"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Estado
                <RequiredMark />
              </Label>
              <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-country`}>Pais</Label>
              <Input
                id={`${lead?.id ?? 'new'}-country`}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Peru"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-city`}>Ciudad</Label>
              <Input
                id={`${lead?.id ?? 'new'}-city`}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lima"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-industry`}>Rubro</Label>
              <Input
                id={`${lead?.id ?? 'new'}-industry`}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Logistica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-source`}>Fuente</Label>
              <Input
                id={`${lead?.id ?? 'new'}-source`}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Web, referido, evento..."
              />
            </div>
          </div>

          {canAssign && (
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={ownerValue} onValueChange={setOwnerValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Sin responsable</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name || owner.email} ({ROLE_LABEL[owner.role] ?? owner.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-phones`}>
                Telefonos (uno por linea o separados por coma)
              </Label>
              <Textarea
                id={`${lead?.id ?? 'new'}-phones`}
                value={phonesText}
                onChange={(e) => setPhonesText(e.target.value)}
                placeholder="+51 999 111 222"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-emails`}>
                Emails (uno por linea o separados por coma)
              </Label>
              <Textarea
                id={`${lead?.id ?? 'new'}-emails`}
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                placeholder="ventas@empresa.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${lead?.id ?? 'new'}-gerente`}>Gerente / Responsable</Label>
            <Input
              id={`${lead?.id ?? 'new'}-gerente`}
              value={gerente}
              onChange={(e) => setGerente(e.target.value)}
              placeholder="Juan Pérez"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-contactName`}>Persona de contacto</Label>
              <Input
                id={`${lead?.id ?? 'new'}-contactName`}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="María García"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${lead?.id ?? 'new'}-contactPhone`}>Teléfono de contacto</Label>
              <Input
                id={`${lead?.id ?? 'new'}-contactPhone`}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+51 999 123 456"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${lead?.id ?? 'new'}-notes`}>Notas</Label>
            <Textarea
              id={`${lead?.id ?? 'new'}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-30"
              placeholder="Contexto comercial, comentarios y acuerdos..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
