import { LeadStatus } from '@prisma/client';
import { parseDelimitedList } from '@/lib/lead-normalization';

export const IMPORT_TEMPLATE_HEADERS = [
  'businessName',
  'ruc',
  'country',
  'city',
  'industry',
  'source',
  'gerente',
  'contactName',
  'contactPhone',
  'notes',
  'phones',
  'emails',
  'status',
  'ownerEmail',
] as const;

type ImportColumn = (typeof IMPORT_TEMPLATE_HEADERS)[number];

type RawCsvRecord = Record<string, string>;

export const IMPORT_SAMPLE_CSV = [
  IMPORT_TEMPLATE_HEADERS.join(','),
  'Acme Logistics SAC,20123456789,Peru,Lima,Logistica,Web,Ana Gerente,Lucia Torres,+51 988 111 222,"Cliente demo",+51 999 111 222,ventas@acme.com,NEW,admin@acme.com',
  'Importadora Norte,,Peru,Piura,Comercio exterior,Referido,Carlos Ruiz,Mario Quispe,+51 944 222 333,"Requiere seguimiento",+51 955 123 456,comercial@norte.com,CONTACTED,',
].join('\n');

const COLUMN_ALIASES: Record<string, ImportColumn> = {
  businessname: 'businessName',
  business_name: 'businessName',
  razonsocial: 'businessName',
  razon_social: 'businessName',
  ruc: 'ruc',
  country: 'country',
  pais: 'country',
  city: 'city',
  ciudad: 'city',
  industry: 'industry',
  rubro: 'industry',
  source: 'source',
  fuente: 'source',
  gerente: 'gerente',
  responsable: 'gerente',
  contactname: 'contactName',
  contact_name: 'contactName',
  personacontacto: 'contactName',
  persona_contacto: 'contactName',
  contactphone: 'contactPhone',
  contact_phone: 'contactPhone',
  telefonocontacto: 'contactPhone',
  telefono_contacto: 'contactPhone',
  notes: 'notes',
  notas: 'notes',
  phones: 'phones',
  telefonos: 'phones',
  telefono: 'phones',
  emails: 'emails',
  email: 'emails',
  correos: 'emails',
  status: 'status',
  estado: 'status',
  owneremail: 'ownerEmail',
  owner_email: 'ownerEmail',
  owner: 'ownerEmail',
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

export function parseCsvText(input: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      currentCell = '';

      if (currentRow.some((value) => value.trim().length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    throw new Error('El CSV tiene comillas sin cerrar');
  }

  currentRow.push(currentCell);
  if (currentRow.some((value) => value.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

export function parseImportStatus(value: string | undefined): LeadStatus {
  const normalized = value?.trim().toUpperCase();

  if (!normalized) return LeadStatus.NEW;
  if (normalized === 'NEW' || normalized === 'NUEVO') return LeadStatus.NEW;
  if (normalized === 'CONTACTED' || normalized === 'CONTACTADO') return LeadStatus.CONTACTED;
  if (normalized === 'QUALIFIED' || normalized === 'CALIFICADO') return LeadStatus.QUALIFIED;
  if (normalized === 'LOST' || normalized === 'PERDIDO') return LeadStatus.LOST;
  if (normalized === 'WON' || normalized === 'GANADO') return LeadStatus.WON;

  throw new Error(`Estado invalido: ${value}`);
}

export function parseImportCsvRecords(input: string): RawCsvRecord[] {
  const rows = parseCsvText(input.trim());

  if (rows.length < 2) {
    throw new Error('El CSV debe incluir encabezados y al menos una fila de datos');
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map(
    (header) => COLUMN_ALIASES[normalizeHeader(header)] ?? header.trim(),
  );

  if (!headers.includes('ruc')) {
    throw new Error('El archivo debe incluir la columna ruc (RUC/código de empresa)');
  }

  return dataRows.map((row) => {
    const record: RawCsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? '';
    });

    return record;
  });
}

export function mapCsvRecordToImportRow(record: RawCsvRecord) {
  return {
    businessName: record.businessName || undefined,
    ruc: record.ruc ?? '',
    country: record.country || undefined,
    city: record.city || undefined,
    industry: record.industry || undefined,
    source: record.source || undefined,
    gerente: record.gerente || undefined,
    contactName: record.contactName || undefined,
    contactPhone: record.contactPhone || undefined,
    notes: record.notes || undefined,
    phones: parseDelimitedList(record.phones),
    emails: parseDelimitedList(record.emails),
    status: parseImportStatus(record.status),
    ownerEmail: record.ownerEmail?.trim().toLowerCase() || undefined,
  };
}
