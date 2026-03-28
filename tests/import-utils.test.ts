import { describe, expect, it } from 'vitest';
import { LeadStatus } from '@prisma/client';
import {
  mapCsvRecordToImportRow,
  parseCsvText,
  parseImportCsvRecords,
  parseImportStatus,
} from '@/lib/import-utils';

describe('import utils', () => {
  it('parsea CSV con comillas y comas embebidas', () => {
    const rows = parseCsvText('businessName,notes\n"Acme, SAC","Cliente, prioritario"');

    expect(rows).toEqual([
      ['businessName', 'notes'],
      ['Acme, SAC', 'Cliente, prioritario'],
    ]);
  });

  it('acepta alias de columnas y construye records', () => {
    const records = parseImportCsvRecords(
      'razon_social,telefonos,correos,estado\nAcme,+51 999 111 222,ventas@acme.com,Contactado',
    );

    expect(records[0]).toMatchObject({
      businessName: 'Acme',
      phones: '+51 999 111 222',
      emails: 'ventas@acme.com',
      status: 'Contactado',
    });
  });

  it('convierte una fila CSV a payload importable', () => {
    const row = mapCsvRecordToImportRow({
      businessName: 'Acme Logistics',
      phones: '+51 999 111 222; +51 955 000 111',
      emails: 'ventas@acme.com;ops@acme.com',
      status: 'Ganado',
      ownerEmail: 'ADMIN@ACME.COM',
    });

    expect(row).toEqual({
      businessName: 'Acme Logistics',
      ruc: undefined,
      country: undefined,
      city: undefined,
      industry: undefined,
      source: undefined,
      notes: undefined,
      phones: ['+51 999 111 222', '+51 955 000 111'],
      emails: ['ventas@acme.com', 'ops@acme.com'],
      status: LeadStatus.WON,
      ownerEmail: 'admin@acme.com',
    });
  });

  it('normaliza estados en inglés y español', () => {
    expect(parseImportStatus('NEW')).toBe(LeadStatus.NEW);
    expect(parseImportStatus('Calificado')).toBe(LeadStatus.QUALIFIED);
    expect(parseImportStatus(undefined)).toBe(LeadStatus.NEW);
  });
});
