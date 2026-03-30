import { describe, expect, it } from 'vitest';
import {
  normalizeEmail,
  normalizeEmails,
  normalizeLeadName,
  normalizePhone,
  normalizePhones,
  normalizeRuc,
  parseDelimitedList,
} from '@/lib/lead-normalization';

describe('normalizeRuc', () => {
  it('elimina caracteres no alfanuméricos y convierte a mayúsculas', () => {
    expect(normalizeRuc('12.345.678-9')).toBe('123456789');
    expect(normalizeRuc('abc-def')).toBe('ABCDEF');
    expect(normalizeRuc('20123456789')).toBe('20123456789');
  });

  it('retorna null para valores vacíos, null o undefined', () => {
    expect(normalizeRuc(null)).toBeNull();
    expect(normalizeRuc(undefined)).toBeNull();
    expect(normalizeRuc('')).toBeNull();
    expect(normalizeRuc('   ')).toBeNull();
  });

  it('retorna null cuando el valor contiene solo caracteres no alfanuméricos', () => {
    expect(normalizeRuc('---')).toBeNull();
    expect(normalizeRuc('...')).toBeNull();
  });
});

describe('normalizeLeadName', () => {
  it('convierte a minúsculas y elimina acentos diacríticos', () => {
    expect(normalizeLeadName('Café S.A.')).toBe('cafe s.a.');
    expect(normalizeLeadName('Logística Ávila')).toBe('logistica avila');
    expect(normalizeLeadName('ACME CORP')).toBe('acme corp');
  });

  it('colapsa espacios múltiples y elimina espacios al inicio/final', () => {
    expect(normalizeLeadName('  empresa   grande  ')).toBe('empresa grande');
    expect(normalizeLeadName('Dos  Espacios')).toBe('dos espacios');
  });
});

describe('normalizeEmail', () => {
  it('hace trim y convierte a minúsculas', () => {
    expect(normalizeEmail('  FOO@BAR.COM  ')).toBe('foo@bar.com');
    expect(normalizeEmail('User@Example.org')).toBe('user@example.org');
  });
});

describe('normalizeEmails', () => {
  it('normaliza y deduplica emails manteniendo el primer valor único', () => {
    expect(normalizeEmails(['  FOO@BAR.COM', 'foo@bar.com', 'OTHER@EXAMPLE.COM'])).toEqual([
      'foo@bar.com',
      'other@example.com',
    ]);
  });

  it('retorna array vacío para null, undefined o array vacío', () => {
    expect(normalizeEmails(null)).toEqual([]);
    expect(normalizeEmails(undefined)).toEqual([]);
    expect(normalizeEmails([])).toEqual([]);
  });
});

describe('normalizePhone', () => {
  it('hace trim y colapsa espacios internos múltiples en uno', () => {
    expect(normalizePhone('  999 888 777  ')).toBe('999 888 777');
    expect(normalizePhone('+51  999  888')).toBe('+51 999 888');
  });
});

describe('normalizePhones', () => {
  it('normaliza y deduplica teléfonos manteniendo el primer valor único', () => {
    expect(normalizePhones(['999 888 777', '999 888 777', '111 222 333'])).toEqual([
      '999 888 777',
      '111 222 333',
    ]);
  });

  it('retorna array vacío para null, undefined o array vacío', () => {
    expect(normalizePhones(null)).toEqual([]);
    expect(normalizePhones(undefined)).toEqual([]);
    expect(normalizePhones([])).toEqual([]);
  });
});

describe('parseDelimitedList', () => {
  it('separa por comas, punto y coma, y saltos de línea', () => {
    expect(parseDelimitedList('a,b;c\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filtra entradas vacías entre separadores', () => {
    expect(parseDelimitedList('a,,b')).toEqual(['a', 'b']);
    expect(parseDelimitedList(',a,')).toEqual(['a']);
  });

  it('hace trim de cada elemento', () => {
    expect(parseDelimitedList(' uno , dos , tres ')).toEqual(['uno', 'dos', 'tres']);
  });

  it('retorna array vacío para valores nulos, undefined o vacíos', () => {
    expect(parseDelimitedList(null)).toEqual([]);
    expect(parseDelimitedList(undefined)).toEqual([]);
    expect(parseDelimitedList('')).toEqual([]);
  });
});
