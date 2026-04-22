import { describe, expect, it } from 'vitest';
import {
  buildLeadContactCreateManyData,
  getLegacyContactFields,
  normalizeLeadContacts,
} from '@/lib/lead-contacts';

describe('lead contacts helpers', () => {
  it('normaliza contactos multiples y omite contactos vacios', () => {
    const contacts = normalizeLeadContacts([
      {
        name: ' Laura ',
        phones: [' +51 944 100 200 ', '+51 944 100 200'],
        emails: ['LAURA@ACME.COM'],
      },
      {
        name: '',
        phones: [],
        emails: [],
      },
      {
        name: 'Mario',
        phones: ['+51 955 200 300'],
        emails: ['mario@acme.com'],
      },
    ]);

    expect(contacts).toEqual([
      {
        name: 'Laura',
        phones: ['+51 944 100 200'],
        emails: ['laura@acme.com'],
        role: null,
        notes: null,
        isPrimary: true,
        sortOrder: 0,
      },
      {
        name: 'Mario',
        phones: ['+51 955 200 300'],
        emails: ['mario@acme.com'],
        role: null,
        notes: null,
        isPrimary: false,
        sortOrder: 1,
      },
    ]);
  });

  it('deriva campos legacy desde el contacto principal', () => {
    const contacts = normalizeLeadContacts([
      { name: 'Laura', phones: ['+51 944 100 200'], emails: [] },
      { name: 'Mario', phones: ['+51 955 200 300'], emails: [], isPrimary: true },
    ]);

    expect(getLegacyContactFields(contacts)).toEqual({
      contactName: 'Mario',
      contactPhone: '+51 955 200 300',
    });
  });

  it('construye payload createMany para Prisma', () => {
    const contacts = normalizeLeadContacts([
      { name: 'Laura', phones: ['+51 944 100 200'], emails: ['laura@acme.com'] },
    ]);

    expect(buildLeadContactCreateManyData('tenant-1', 'lead-1', contacts)).toEqual([
      {
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        name: 'Laura',
        phones: ['+51 944 100 200'],
        emails: ['laura@acme.com'],
        role: null,
        notes: null,
        isPrimary: true,
        sortOrder: 0,
      },
    ]);
  });
});
