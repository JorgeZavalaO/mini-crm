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
  'contactEmail',
  'notes',
  'phones',
  'emails',
  'status',
  'ownerEmail',
] as const;

type ImportColumn = string;

type RawCsvRecord = Record<string, string>;

type MapCsvRecordOptions = {
  defaultStatus?: boolean;
};

export const IMPORT_SAMPLE_CSV = [
  IMPORT_TEMPLATE_HEADERS.join(','),
  'Acme Logistics SAC,20123456789,Peru,Lima,Logistica,Web,Ana Gerente,"Lucia Torres,Mario Lopez","+51 988 111 222,+51 955 000 111","compras@acme.com,operaciones@acme.com","Cliente demo",+51 999 111 222,ventas@acme.com,NEW,admin@acme.com',
  'Importadora Norte,,Peru,Piura,Comercio exterior,Referido,Carlos Ruiz,Mario Quispe,+51 944 222 333,comercial@norte.com,"Requiere seguimiento",+51 955 123 456,comercial@norte.com,CONTACTED,',
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
  contactnames: 'contactName',
  contact_name: 'contactName',
  contact_names: 'contactName',
  contacto: 'contactName',
  contactos: 'contactName',
  personacontacto: 'contactName',
  persona_contacto: 'contactName',
  nombrescontacto: 'contactName',
  nombres_contacto: 'contactName',
  contactphone: 'contactPhone',
  contactphones: 'contactPhone',
  contact_phone: 'contactPhone',
  contact_phones: 'contactPhone',
  telefonocontacto: 'contactPhone',
  telefono_contacto: 'contactPhone',
  telefonoscontacto: 'contactPhone',
  telefonos_contacto: 'contactPhone',
  contactemail: 'contactEmail',
  contactemails: 'contactEmail',
  contact_email: 'contactEmail',
  contact_emails: 'contactEmail',
  correocontacto: 'contactEmail',
  correo_contacto: 'contactEmail',
  correoscontacto: 'contactEmail',
  correos_contacto: 'contactEmail',
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

function parseContactColumnSegments(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeContactHeader(value: string): ImportColumn | null {
  const englishMatch = value.match(
    /^contact(\d+)(name|phone|phones|email|emails|role|title|notes)$/,
  );
  const spanishMatch = value.match(
    /^contacto(\d+)(nombre|telefono|telefonos|correo|correos|email|emails|rol|cargo|notas)$/,
  );
  const match = englishMatch ?? spanishMatch;
  if (!match) return null;

  const [, index, rawField] = match;
  const fieldMap: Record<string, 'Name' | 'Phones' | 'Emails' | 'Role' | 'Notes'> = {
    name: 'Name',
    nombre: 'Name',
    phone: 'Phones',
    phones: 'Phones',
    telefono: 'Phones',
    telefonos: 'Phones',
    email: 'Emails',
    emails: 'Emails',
    correo: 'Emails',
    correos: 'Emails',
    role: 'Role',
    title: 'Role',
    rol: 'Role',
    cargo: 'Role',
    notes: 'Notes',
    notas: 'Notes',
  };

  const field = fieldMap[rawField];
  return field ? `contact${Number(index)}${field}` : null;
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

export function parseImportStatus(
  value: string | undefined,
  options: { defaultStatus?: boolean } = {},
): LeadStatus | undefined {
  const normalized = value?.trim().toUpperCase();

  if (!normalized) return options.defaultStatus === false ? undefined : LeadStatus.NEW;
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
  const headers = headerRow.map((header) => {
    const normalized = normalizeHeader(header);
    return COLUMN_ALIASES[normalized] ?? normalizeContactHeader(normalized) ?? header.trim();
  });

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

function parseImportContacts(record: RawCsvRecord) {
  const contactsByIndex = new Map<
    number,
    { name?: string; phones?: string; emails?: string; role?: string; notes?: string }
  >();
  let hasContactColumns =
    Object.prototype.hasOwnProperty.call(record, 'contactName') ||
    Object.prototype.hasOwnProperty.call(record, 'contactPhone') ||
    Object.prototype.hasOwnProperty.call(record, 'contactEmail') ||
    Object.prototype.hasOwnProperty.call(record, 'contactRole') ||
    Object.prototype.hasOwnProperty.call(record, 'contactNotes');

  for (const [key, rawValue] of Object.entries(record)) {
    const match = key.match(/^contact(\d+)(Name|Phones|Emails|Role|Notes)$/);
    if (!match) continue;

    hasContactColumns = true;
    const value = rawValue.trim();
    if (!value) continue;

    const index = Number(match[1]);
    const field = match[2] as 'Name' | 'Phones' | 'Emails' | 'Role' | 'Notes';
    const contact = contactsByIndex.get(index) ?? {};

    if (field === 'Name') contact.name = value;
    if (field === 'Phones') contact.phones = value;
    if (field === 'Emails') contact.emails = value;
    if (field === 'Role') contact.role = value;
    if (field === 'Notes') contact.notes = value;

    contactsByIndex.set(index, contact);
  }

  const contacts = Array.from(contactsByIndex.entries())
    .sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, contact], index) => ({
      name: contact.name || undefined,
      phones: parseDelimitedList(contact.phones),
      emails: parseDelimitedList(contact.emails),
      role: contact.role || undefined,
      notes: contact.notes || undefined,
      isPrimary: index === 0,
    }))
    .filter(
      (contact) => Boolean(contact.name) || contact.phones.length > 0 || contact.emails.length > 0,
    );

  if (contacts.length === 0 && (record.contactName || record.contactPhone || record.contactEmail)) {
    const names = parseContactColumnSegments(record.contactName);
    const phoneGroups = parseContactColumnSegments(record.contactPhone);
    const emailGroups = parseContactColumnSegments(record.contactEmail);
    const roles = parseContactColumnSegments(record.contactRole);
    const notes = parseContactColumnSegments(record.contactNotes);
    const maxContacts = Math.max(
      names.length,
      phoneGroups.length,
      emailGroups.length,
      roles.length,
      notes.length,
    );

    for (let index = 0; index < maxContacts; index += 1) {
      const contact = {
        name: names[index] || undefined,
        phones: parseDelimitedList(phoneGroups[index]),
        emails: parseDelimitedList(emailGroups[index]),
        role: roles[index] || undefined,
        notes: notes[index] || undefined,
        isPrimary: index === 0,
      };

      if (contact.name || contact.phones.length > 0 || contact.emails.length > 0) {
        contacts.push(contact);
      }
    }
  }

  return { contacts, hasContactColumns };
}

export function mapCsvRecordToImportRow(record: RawCsvRecord, options: MapCsvRecordOptions = {}) {
  const contactResult = parseImportContacts(record);

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
    contacts: contactResult.contacts,
    hasContactColumns: contactResult.hasContactColumns,
    status: parseImportStatus(record.status, {
      defaultStatus: options.defaultStatus,
    }),
    ownerEmail: record.ownerEmail?.trim().toLowerCase() || undefined,
  };
}
