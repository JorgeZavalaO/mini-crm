import { describe, expect, it } from 'vitest';
import { InteractionType } from '@prisma/client';
import {
  mapCsvRecordToInteractionImportRow,
  parseImportInteractionType,
  parseImportOccurredAt,
  parseInteractionImportCsvRecords,
} from '@/lib/interaction-import-utils';
import { importInteractionRowSchema } from '@/lib/validators';

describe('interaction import utils', () => {
  it('acepta alias de columnas en espanol y parsea la fila', () => {
    const records = parseInteractionImportCsvRecords(
      'ruc,correoAutor,tipo,fecha,asunto,notas\n20123456789,vendedor@acme.com,Llamada,2026-03-30 10:00,Llamada inicial,Cliente interesado',
    );
    const row = mapCsvRecordToInteractionImportRow(records[0], 'America/Lima');

    expect(row).toMatchObject({
      ruc: '20123456789',
      authorEmail: 'vendedor@acme.com',
      type: InteractionType.CALL,
      subject: 'Llamada inicial',
      notes: 'Cliente interesado',
    });
    expect(row.occurredAt.toISOString()).toBe('2026-03-30T15:00:00.000Z');
  });

  it('acepta fechas anteriores sin hora y las interpreta a las 00:00 local', () => {
    const occurredAt = parseImportOccurredAt('2025-12-31', 'America/Lima');

    expect(occurredAt.toISOString()).toBe('2025-12-31T05:00:00.000Z');
  });

  it('permite omitir la columna subject porque el asunto es opcional', () => {
    const records = parseInteractionImportCsvRecords(
      'ruc,authorEmail,type,occurredAt,notes\n20123456789,vendedor@acme.com,EMAIL,2026-03-30,Correo enviado',
    );
    const row = mapCsvRecordToInteractionImportRow(records[0], 'America/Lima');

    expect(row.subject).toBeUndefined();
    expect(row.type).toBe(InteractionType.EMAIL);
  });

  it('acepta formato dia/mes/anio con hora', () => {
    const occurredAt = parseImportOccurredAt('27/03/2026 15:30', 'America/Lima');

    expect(occurredAt.toISOString()).toBe('2026-03-27T20:30:00.000Z');
  });

  it('rechaza fechas invalidas', () => {
    expect(() => parseImportOccurredAt('2026-02-31', 'America/Lima')).toThrow(
      /fecha de interaccion invalida/i,
    );
  });

  it('mapea tipos no contemplados a NOTE, pero exige tipo no vacio', () => {
    expect(parseImportInteractionType('otro canal')).toBe(InteractionType.NOTE);
    expect(() => parseImportInteractionType('')).toThrow(/tipo de interaccion/i);
  });

  it('rechaza notas vacias en el schema de fila importable', () => {
    expect(() =>
      importInteractionRowSchema.parse({
        ruc: '20123456789',
        authorEmail: 'vendedor@acme.com',
        type: InteractionType.CALL,
        occurredAt: new Date('2026-03-30T15:00:00.000Z'),
        notes: '',
      }),
    ).toThrow(/notas/i);
  });
});
