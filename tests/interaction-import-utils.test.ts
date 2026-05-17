import { describe, expect, it } from 'vitest';
import { InteractionType } from '@prisma/client';
import {
  mapCsvRecordToInteractionImportRow,
  parseImportInteractionType,
  parseImportOccurredAt,
  parseInteractionImportCsvRecords,
  parseMultipleInteractionTypes,
  parseMultipleSubjects,
  parseMultipleNotes,
  expandMultipleInteractionsRow,
  isMultipleInteractionRow,
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

  // Tests para múltiples interacciones por línea
  describe('multiple interactions per line', () => {
    it('parsea multiples tipos separados por punto y coma', () => {
      const types = parseMultipleInteractionTypes('Correo;WhatsApp;Llamada');
      expect(types).toEqual([
        InteractionType.EMAIL,
        InteractionType.WHATSAPP,
        InteractionType.CALL,
      ]);
    });

    it('parsea multiples asuntos permitiendo vacios', () => {
      const subjects = parseMultipleSubjects('Asunto1;;Asunto3', 3);
      expect(subjects).toEqual(['Asunto1', undefined, 'Asunto3']);
    });

    it('rechaza asuntos si cantidad no coincide con tipos', () => {
      expect(() => parseMultipleSubjects('Asunto1;Asunto2', 3)).toThrow(/cantidad de asuntos/i);
    });

    it('parsea multiples notas separadas por punto y coma', () => {
      const notes = parseMultipleNotes('Nota1;Nota2;Nota3', 3);
      expect(notes).toEqual(['Nota1', 'Nota2', 'Nota3']);
    });

    it('rechaza notas vacias', () => {
      expect(() => parseMultipleNotes('Nota1;;Nota3', 3)).toThrow(
        /comentarios no pueden estar vacios/i,
      );
    });

    it('rechaza notas si cantidad no coincide con tipos', () => {
      expect(() => parseMultipleNotes('Nota1;Nota2', 3)).toThrow(/cantidad de comentarios/i);
    });

    it('rechaza mas de 10 tipos por linea', () => {
      const types = Array(11).fill('Correo').join(';');
      expect(() => parseMultipleInteractionTypes(types)).toThrow(/maximo 10/i);
    });

    it('detecta fila con formato multiple', () => {
      const recordMultiple = {
        ruc: '20123456789',
        authorEmail: 'vendedor@acme.com',
        types: 'Correo;WhatsApp',
        occurredAt: '2026-03-30',
        subjects: 'Asunto1;Asunto2',
        notes: 'Nota1;Nota2',
        type: '',
      };
      expect(isMultipleInteractionRow(recordMultiple)).toBe(true);
    });

    it('no detecta fila con formato simple', () => {
      const recordSimple = {
        ruc: '20123456789',
        authorEmail: 'vendedor@acme.com',
        type: 'CALL',
        occurredAt: '2026-03-30',
        subject: 'Asunto1',
        notes: 'Nota1',
        types: '',
      };
      expect(isMultipleInteractionRow(recordSimple)).toBe(false);
    });

    it('expande fila con multiples interacciones', () => {
      const record = {
        ruc: '20123456789',
        authorEmail: 'vendedor@acme.com',
        types: 'Correo;WhatsApp;Llamada',
        occurredAt: '2026-03-30',
        subjects: 'Asunto1;Asunto2;Asunto3',
        notes: 'Nota1;Nota2;Nota3',
        type: '',
      };
      const expanded = expandMultipleInteractionsRow(record, 'America/Lima');

      expect(expanded).toHaveLength(3);
      expect(expanded[0]).toMatchObject({
        ruc: '20123456789',
        authorEmail: 'vendedor@acme.com',
        type: InteractionType.EMAIL,
        subject: 'Asunto1',
        notes: 'Nota1',
      });
      expect(expanded[1].type).toBe(InteractionType.WHATSAPP);
      expect(expanded[2].type).toBe(InteractionType.CALL);
      // Verificar que todas comparten la misma fecha
      expect(expanded[0].occurredAt.getTime()).toBe(expanded[1].occurredAt.getTime());
      expect(expanded[1].occurredAt.getTime()).toBe(expanded[2].occurredAt.getTime());
    });

    it('retorna array con un elemento para fila simple', () => {
      const record = {
        ruc: '20123456789',
        authorEmail: 'vendedor@acme.com',
        type: 'CALL',
        occurredAt: '2026-03-30',
        subject: 'Asunto1',
        notes: 'Nota1',
        types: '',
      };
      const expanded = expandMultipleInteractionsRow(record, 'America/Lima');

      expect(expanded).toHaveLength(1);
      expect(expanded[0].type).toBe(InteractionType.CALL);
    });

    it('rechaza expansion si tipos y notas no coinciden en cantidad', () => {
      const record = {
        ruc: '20123456789',
        authorEmail: 'vendedor@acme.com',
        types: 'Correo;WhatsApp',
        occurredAt: '2026-03-30',
        subjects: 'Asunto1;Asunto2',
        notes: 'Nota1;Nota2;Nota3',
        type: '',
      };
      expect(() => expandMultipleInteractionsRow(record, 'America/Lima')).toThrow(
        /cantidad de comentarios/i,
      );
    });

    it('parsea CSV con formato multiple', () => {
      const csvText = `ruc,authorEmail,types,occurredAt,subjects,notes
20123456789,vendedor@acme.com,"Correo;WhatsApp",2026-03-30,"Asunto1;Asunto2","Nota1;Nota2"`;
      const records = parseInteractionImportCsvRecords(csvText);

      expect(records).toHaveLength(1);
      expect(records[0].types).toBe('Correo;WhatsApp');
      expect(records[0].subjects).toBe('Asunto1;Asunto2');
    });
  });
});
