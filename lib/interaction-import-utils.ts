import { InteractionType } from '@prisma/client';
import { DEFAULT_TIMEZONE } from '@/lib/date-utils';
import { parseCsvText } from '@/lib/import-utils';

export const INTERACTION_IMPORT_TEMPLATE_HEADERS = [
  'ruc',
  'authorEmail',
  'type',
  'occurredAt',
  'subject',
  'notes',
] as const;

export const INTERACTION_IMPORT_TEMPLATE_HEADERS_MULTIPLE = [
  'ruc',
  'authorEmail',
  'types',
  'occurredAt',
  'subjects',
  'notes',
] as const;

const REQUIRED_INTERACTION_IMPORT_HEADERS = ['ruc', 'authorEmail', 'occurredAt', 'notes'] as const;

export const INTERACTION_IMPORT_SAMPLE_CSV = [
  INTERACTION_IMPORT_TEMPLATE_HEADERS.join(','),
  '20123456789,vendedor@acme.com,CALL,2026-03-30 10:00,Llamada inicial,"Cliente solicita cotizacion para importacion"',
  '20123456789,supervisor@acme.com,WHATSAPP,2026-03-28,Seguimiento,"Envia documentos por WhatsApp"',
].join('\n');

export const INTERACTION_IMPORT_SAMPLE_CSV_MULTIPLE = [
  INTERACTION_IMPORT_TEMPLATE_HEADERS_MULTIPLE.join(','),
  '20123456789,vendedor@acme.com,"Correo;WhatsApp;Llamada",2026-03-30,"Envio de documentos;Seguimiento;Contacto telefónico","Documentos de importacion;Cliente solicita cotizacion;Acordar proxima reunion"',
].join('\n');

type ImportInteractionColumn = (typeof INTERACTION_IMPORT_TEMPLATE_HEADERS)[number];
type RawCsvRecord = Record<string, string>;

const COLUMN_ALIASES: Record<string, string> = {
  ruc: 'ruc',
  codigo: 'ruc',
  codigolead: 'ruc',
  codigo_lead: 'ruc',
  authoremail: 'authorEmail',
  author_email: 'authorEmail',
  correoautor: 'authorEmail',
  correo_autor: 'authorEmail',
  emailautor: 'authorEmail',
  email_autor: 'authorEmail',
  tipo: 'type',
  type: 'type',
  tipos: 'types',
  types: 'types',
  fecha: 'occurredAt',
  fechainteraccion: 'occurredAt',
  fecha_interaccion: 'occurredAt',
  occurredat: 'occurredAt',
  occurred_at: 'occurredAt',
  asunto: 'subject',
  subject: 'subject',
  asuntos: 'subjects',
  subjects: 'subjects',
  notas: 'notes',
  notes: 'notes',
};

const INTERACTION_TYPE_ALIASES: Record<string, InteractionType> = {
  call: InteractionType.CALL,
  llamada: InteractionType.CALL,
  llamadas: InteractionType.CALL,
  phone: InteractionType.CALL,
  telefono: InteractionType.CALL,
  email: InteractionType.EMAIL,
  mail: InteractionType.EMAIL,
  correo: InteractionType.EMAIL,
  correos: InteractionType.EMAIL,
  correoelectronico: InteractionType.EMAIL,
  correo_electronico: InteractionType.EMAIL,
  note: InteractionType.NOTE,
  nota: InteractionType.NOTE,
  notas: InteractionType.NOTE,
  visit: InteractionType.VISIT,
  visita: InteractionType.VISIT,
  visitas: InteractionType.VISIT,
  whatsapp: InteractionType.WHATSAPP,
  whatsap: InteractionType.WHATSAPP,
  whats_app: InteractionType.WHATSAPP,
  wsp: InteractionType.WHATSAPP,
  wa: InteractionType.WHATSAPP,
};

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

function normalizeHeader(value: string): string {
  return normalizeToken(value);
}

function normalizeTypeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

function parseDateParts(rawValue: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const value = rawValue.trim();
  const ymdMatch = value.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  const dmyMatch = value.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  const match = ymdMatch ?? dmyMatch;

  if (!match) {
    throw new Error('Fecha de interaccion invalida');
  }

  const year = Number(ymdMatch ? match[1] : match[3]);
  const month = Number(match[2]);
  const day = Number(ymdMatch ? match[3] : match[1]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);

  const utcCheck = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const isValidDate =
    utcCheck.getUTCFullYear() === year &&
    utcCheck.getUTCMonth() === month - 1 &&
    utcCheck.getUTCDate() === day &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59;

  if (!isValidDate) {
    throw new Error('Fecha de interaccion invalida');
  }

  return { year, month, day, hour, minute, second };
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
  const localAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return localAsUtc - date.getTime();
}

function formatInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
}

function localDateTimeToUtc(
  parts: ReturnType<typeof parseDateParts>,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let utcMs = localAsUtc;

  for (let i = 0; i < 3; i += 1) {
    utcMs = localAsUtc - getTimeZoneOffsetMs(new Date(utcMs), timezone);
  }

  const result = new Date(utcMs);
  const rendered = formatInTimezone(result, timezone);
  const matchesLocalInput =
    rendered.year === parts.year &&
    rendered.month === parts.month &&
    rendered.day === parts.day &&
    rendered.hour === parts.hour &&
    rendered.minute === parts.minute &&
    rendered.second === parts.second;

  if (!matchesLocalInput) {
    throw new Error('Fecha de interaccion invalida');
  }

  return result;
}

export function parseInteractionImportCsvRecords(input: string): RawCsvRecord[] {
  const rows = parseCsvText(input.trim());

  if (rows.length < 2) {
    throw new Error('El CSV debe incluir encabezados y al menos una fila de datos');
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => {
    const normalized = normalizeHeader(header);
    return COLUMN_ALIASES[normalized] ?? header.trim();
  });
  const missingHeaders = REQUIRED_INTERACTION_IMPORT_HEADERS.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`El archivo debe incluir las columnas: ${missingHeaders.join(', ')}`);
  }

  const hasTypeColumn = headers.includes('type');
  const hasTypesColumn = headers.includes('types');

  if (!hasTypeColumn && !hasTypesColumn) {
    throw new Error(
      'El archivo debe incluir la columna "type" (para importacion individual) o "types" (para multiples interacciones por linea)',
    );
  }

  return dataRows.map((row) => {
    const record: RawCsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? '';
    });

    return record;
  });
}

export function parseImportInteractionType(value: string | undefined): InteractionType {
  const normalized = normalizeTypeToken(value ?? '');
  const upper = normalized.toUpperCase();

  if (!normalized) {
    throw new Error('El tipo de interaccion es requerido');
  }

  if (upper in InteractionType) {
    return InteractionType[upper as keyof typeof InteractionType];
  }

  return INTERACTION_TYPE_ALIASES[normalized] ?? InteractionType.NOTE;
}

export function parseImportOccurredAt(
  value: string | undefined,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const rawValue = value?.trim();

  if (!rawValue) {
    throw new Error('La fecha de interaccion es requerida');
  }

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(rawValue)) {
    const date = new Date(rawValue);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Fecha de interaccion invalida');
    }
    return date;
  }

  try {
    return localDateTimeToUtc(parseDateParts(rawValue), timezone);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error('Zona horaria invalida');
    }
    throw error;
  }
}

export function parseMultipleInteractionTypes(value: string | undefined): InteractionType[] {
  const rawValue = value?.trim();

  if (!rawValue) {
    throw new Error('Los tipos de interaccion son requeridos');
  }

  const types = rawValue.split(';').map((type) => type.trim());

  if (types.length === 0) {
    throw new Error('Los tipos de interaccion son requeridos');
  }

  if (types.length > 10) {
    throw new Error('Maximo 10 interacciones por linea permitidas');
  }

  return types.map((type) => {
    if (!type) {
      throw new Error('El tipo de interaccion es requerido');
    }
    return parseImportInteractionType(type);
  });
}

export function parseMultipleSubjects(
  value: string | undefined,
  expectedCount: number,
): (string | undefined)[] {
  const rawValue = value?.trim();

  if (!rawValue) {
    return Array(expectedCount).fill(undefined);
  }

  const subjects = rawValue.split(';').map((subject) => subject.trim() || undefined);

  if (subjects.length !== expectedCount) {
    throw new Error(
      `Cantidad de asuntos (${subjects.length}) debe coincidir con cantidad de tipos (${expectedCount})`,
    );
  }

  return subjects;
}

export function parseMultipleNotes(value: string | undefined, expectedCount: number): string[] {
  const rawValue = value?.trim();

  if (!rawValue) {
    throw new Error('Las notas son requeridas');
  }

  const notes = rawValue.split(';').map((note) => note.trim());

  if (notes.length !== expectedCount) {
    throw new Error(
      `Cantidad de comentarios (${notes.length}) debe coincidir con cantidad de tipos (${expectedCount})`,
    );
  }

  const hasEmptyNote = notes.some((note) => !note);
  if (hasEmptyNote) {
    throw new Error('Los comentarios no pueden estar vacios');
  }

  return notes;
}

export function isMultipleInteractionRow(record: RawCsvRecord): boolean {
  const hasTypes = Boolean(record.types && record.types.trim().length > 0);
  const hasType = Boolean(record.type && record.type.trim().length > 0);

  return hasTypes && !hasType;
}

export function expandMultipleInteractionsRow(
  record: RawCsvRecord,
  timezone: string = DEFAULT_TIMEZONE,
): ReturnType<typeof mapCsvRecordToInteractionImportRow>[] {
  if (!isMultipleInteractionRow(record)) {
    return [mapCsvRecordToInteractionImportRow(record, timezone)];
  }

  const types = parseMultipleInteractionTypes(record.types);
  const subjects = parseMultipleSubjects(record.subjects, types.length);
  const notes = parseMultipleNotes(record.notes, types.length);
  const occurredAt = parseImportOccurredAt(record.occurredAt, timezone);

  return types.map((type, index) => ({
    ruc: record.ruc ?? '',
    authorEmail: record.authorEmail?.trim().toLowerCase() ?? '',
    type,
    occurredAt,
    subject: subjects[index],
    notes: notes[index] ?? '',
  }));
}

export function mapCsvRecordToInteractionImportRow(
  record: RawCsvRecord,
  timezone: string = DEFAULT_TIMEZONE,
) {
  return {
    ruc: record.ruc ?? '',
    authorEmail: record.authorEmail?.trim().toLowerCase() ?? '',
    type: parseImportInteractionType(record.type),
    occurredAt: parseImportOccurredAt(record.occurredAt, timezone),
    subject: record.subject || undefined,
    notes: record.notes ?? '',
  };
}
