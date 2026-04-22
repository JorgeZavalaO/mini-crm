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
  contacts: Array<{
    id: string;
    name: string | null;
    phones: string[];
    emails: string[];
    role: string | null;
    notes: string | null;
    isPrimary: boolean;
    sortOrder: number;
  }>;
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

type ContactFormValue = {
  name: string;
  phonesText: string;
  emailsText: string;
  role: string;
  notes: string;
};

function RequiredMark() {
  return (
    <span className="ml-1 text-destructive" aria-label="obligatorio">
      *
    </span>
  );
}

function createEmptyContact(): ContactFormValue {
  return {
    name: '',
    phonesText: '',
    emailsText: '',
    role: '',
    notes: '',
  };
}

function getDefaultContacts(lead?: EditableLead): ContactFormValue[] {
  if (lead?.contacts && lead.contacts.length > 0) {
    return lead.contacts.map((contact) => ({
      name: contact.name ?? '',
      phonesText: contact.phones.join('\n'),
      emailsText: contact.emails.join('\n'),
      role: contact.role ?? '',
      notes: contact.notes ?? '',
    }));
  }

  if (lead?.contactName || lead?.contactPhone) {
    return [
      {
        name: lead.contactName ?? '',
        phonesText: lead.contactPhone ?? '',
        emailsText: '',
        role: '',
        notes: '',
      },
    ];
  }

  return [createEmptyContact()];
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
    contacts: getDefaultContacts(lead),
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
  const [contacts, setContacts] = useState<ContactFormValue[]>(defaults.contacts);
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
    setContacts(nextDefaults.contacts);
    setStatus(nextDefaults.status);
    setOwnerValue(nextDefaults.ownerValue);
  }

  function updateContact(index: number, field: keyof ContactFormValue, value: string) {
    setContacts((current) =>
      current.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [field]: value } : contact,
      ),
    );
  }

  function addContact() {
    setContacts((current) => [...current, createEmptyContact()]);
  }

  function removeContact(index: number) {
    setContacts((current) => {
      const nextContacts = current.filter((_, contactIndex) => contactIndex !== index);
      return nextContacts.length > 0 ? nextContacts : [createEmptyContact()];
    });
  }

  function buildContactsPayload() {
    return contacts
      .map((contact, index) => ({
        name: contact.name,
        phones: parseDelimitedList(contact.phonesText),
        emails: parseDelimitedList(contact.emailsText),
        role: contact.role,
        notes: contact.notes,
        isPrimary: index === 0,
      }))
      .filter(
        (contact) => contact.name.trim() || contact.phones.length > 0 || contact.emails.length > 0,
      );
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
      contacts: buildContactsPayload(),
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

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Contactos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addContact}>
                Agregar contacto
              </Button>
            </div>
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={index} className="rounded-md border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Contacto {index + 1}</p>
                    {contacts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContact(index)}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`${lead?.id ?? 'new'}-contact-${index}-name`}>Nombre</Label>
                      <Input
                        id={`${lead?.id ?? 'new'}-contact-${index}-name`}
                        value={contact.name}
                        onChange={(e) => updateContact(index, 'name', e.target.value)}
                        placeholder="Maria Garcia"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${lead?.id ?? 'new'}-contact-${index}-role`}>Cargo</Label>
                      <Input
                        id={`${lead?.id ?? 'new'}-contact-${index}-role`}
                        value={contact.role}
                        onChange={(e) => updateContact(index, 'role', e.target.value)}
                        placeholder="Compras, operaciones..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${lead?.id ?? 'new'}-contact-${index}-phones`}>
                        Telefonos del contacto
                      </Label>
                      <Textarea
                        id={`${lead?.id ?? 'new'}-contact-${index}-phones`}
                        value={contact.phonesText}
                        onChange={(e) => updateContact(index, 'phonesText', e.target.value)}
                        placeholder="+51 999 123 456"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${lead?.id ?? 'new'}-contact-${index}-emails`}>
                        Emails del contacto
                      </Label>
                      <Textarea
                        id={`${lead?.id ?? 'new'}-contact-${index}-emails`}
                        value={contact.emailsText}
                        onChange={(e) => updateContact(index, 'emailsText', e.target.value)}
                        placeholder="maria@empresa.com"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`${lead?.id ?? 'new'}-contact-${index}-notes`}>
                        Notas del contacto
                      </Label>
                      <Textarea
                        id={`${lead?.id ?? 'new'}-contact-${index}-notes`}
                        value={contact.notes}
                        onChange={(e) => updateContact(index, 'notes', e.target.value)}
                        placeholder="Preferencias de contacto o contexto del interlocutor"
                      />
                    </div>
                  </div>
                </div>
              ))}
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
