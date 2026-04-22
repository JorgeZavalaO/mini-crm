import type { Prisma } from '@prisma/client';
import { normalizeEmails, normalizePhones } from '@/lib/lead-normalization';

export type LeadContactInput = {
  name?: string | null;
  phones?: string[] | null;
  emails?: string[] | null;
  role?: string | null;
  notes?: string | null;
  isPrimary?: boolean | null;
};

export type NormalizedLeadContactInput = {
  name: string | null;
  phones: string[];
  emails: string[];
  role: string | null;
  notes: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

function trimOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeLeadContacts(
  contacts: LeadContactInput[] | null | undefined,
): NormalizedLeadContactInput[] {
  if (!contacts || contacts.length === 0) return [];

  const normalized = contacts
    .map((contact) => ({
      name: trimOptional(contact.name),
      phones: normalizePhones(contact.phones ?? []),
      emails: normalizeEmails(contact.emails ?? []),
      role: trimOptional(contact.role),
      notes: trimOptional(contact.notes),
      isPrimary: Boolean(contact.isPrimary),
      sortOrder: 0,
    }))
    .filter(
      (contact) =>
        Boolean(contact.name) ||
        contact.phones.length > 0 ||
        contact.emails.length > 0 ||
        Boolean(contact.role) ||
        Boolean(contact.notes),
    )
    .slice(0, 20);

  const primaryIndex = normalized.findIndex((contact) => contact.isPrimary);

  return normalized.map((contact, index) => ({
    ...contact,
    isPrimary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
    sortOrder: index,
  }));
}

export function getLegacyContactFields(contacts: NormalizedLeadContactInput[]) {
  const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];

  return {
    contactName: primary?.name ?? null,
    contactPhone: primary?.phones[0] ?? null,
  };
}

export function buildLeadContactCreateManyData(
  tenantId: string,
  leadId: string,
  contacts: NormalizedLeadContactInput[],
): Prisma.LeadContactCreateManyInput[] {
  return contacts.map((contact) => ({
    tenantId,
    leadId,
    name: contact.name,
    phones: contact.phones,
    emails: contact.emails,
    role: contact.role,
    notes: contact.notes,
    isPrimary: contact.isPrimary,
    sortOrder: contact.sortOrder,
  }));
}
