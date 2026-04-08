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
      'razon_social,ruc,telefonos,correos,estado,persona_contacto,telefono_contacto\nAcme,20123456789,+51 999 111 222,ventas@acme.com,Contactado,Laura Peña,+51 944 100 200',
    );

    expect(records[0]).toMatchObject({
      businessName: 'Acme',
      ruc: '20123456789',
      phones: '+51 999 111 222',
      emails: 'ventas@acme.com',
      status: 'Contactado',
      contactName: 'Laura Peña',
      contactPhone: '+51 944 100 200',
    });
  });

  it('convierte una fila CSV a payload importable', () => {
    const row = mapCsvRecordToImportRow({
      ruc: '20123456789',
      businessName: 'Acme Logistics',
      phones: '+51 999 111 222; +51 955 000 111',
      emails: 'ventas@acme.com;ops@acme.com',
      status: 'Ganado',
      ownerEmail: 'ADMIN@ACME.COM',
    });

    expect(row).toEqual({
      businessName: 'Acme Logistics',
      ruc: '20123456789',
      country: undefined,
      city: undefined,
      industry: undefined,
      source: undefined,
      gerente: undefined,
      contactName: undefined,
      contactPhone: undefined,
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
