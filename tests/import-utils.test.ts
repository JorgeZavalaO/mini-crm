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
      'razon_social,ruc,telefonos,correos,estado,persona_contacto,telefono_contacto,correo_contacto\nAcme,20123456789,+51 999 111 222,ventas@acme.com,Contactado,Laura Peña,+51 944 100 200,laura@acme.com',
    );

    expect(records[0]).toMatchObject({
      businessName: 'Acme',
      ruc: '20123456789',
      phones: '+51 999 111 222',
      emails: 'ventas@acme.com',
      status: 'Contactado',
      contactName: 'Laura Peña',
      contactPhone: '+51 944 100 200',
      contactEmail: 'laura@acme.com',
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
      contacts: [],
      hasContactColumns: false,
      status: LeadStatus.WON,
      ownerEmail: 'admin@acme.com',
    });
  });

  it('parsea contactos compactos alineados por coma', () => {
    const records = parseImportCsvRecords(
      'ruc,contactName,contactPhone,contactEmail\n20123456789,"Laura,Mario","+51 944 100 200,+51 955 200 300","laura@acme.com,mario@acme.com"',
    );
    const row = mapCsvRecordToImportRow(records[0]);

    expect(row.hasContactColumns).toBe(true);
    expect(row.contacts).toEqual([
      {
        name: 'Laura',
        phones: ['+51 944 100 200'],
        emails: ['laura@acme.com'],
        role: undefined,
        notes: undefined,
        isPrimary: true,
      },
      {
        name: 'Mario',
        phones: ['+51 955 200 300'],
        emails: ['mario@acme.com'],
        role: undefined,
        notes: undefined,
        isPrimary: false,
      },
    ]);
  });

  it('mantiene compatibilidad con contactos numerados', () => {
    const records = parseImportCsvRecords(
      'ruc,contact1Name,contact1Phones,contact1Emails,contact2Name,contact2Phones\n20123456789,Laura,+51 944 100 200; +51 944 100 201,laura@acme.com; compras@acme.com,Mario,+51 955 200 300',
    );
    const row = mapCsvRecordToImportRow(records[0]);

    expect(row.contacts).toEqual([
      {
        name: 'Laura',
        phones: ['+51 944 100 200', '+51 944 100 201'],
        emails: ['laura@acme.com', 'compras@acme.com'],
        role: undefined,
        notes: undefined,
        isPrimary: true,
      },
      {
        name: 'Mario',
        phones: ['+51 955 200 300'],
        emails: [],
        role: undefined,
        notes: undefined,
        isPrimary: false,
      },
    ]);
  });

  it('normaliza estados en inglés y español', () => {
    expect(parseImportStatus('NEW')).toBe(LeadStatus.NEW);
    expect(parseImportStatus('Calificado')).toBe(LeadStatus.QUALIFIED);
    expect(parseImportStatus(undefined)).toBe(LeadStatus.NEW);
  });

  it('permite estado vacio sin default para actualizaciones', () => {
    expect(parseImportStatus(undefined, { defaultStatus: false })).toBeUndefined();
    expect(mapCsvRecordToImportRow({ ruc: '20123456789' }, { defaultStatus: false })).toMatchObject(
      {
        ruc: '20123456789',
        status: undefined,
      },
    );
  });

  it('exige columna ruc en el archivo', () => {
    expect(() => parseImportCsvRecords('businessName\nAcme')).toThrow(/ruc/i);
  });
});
