import type { InteractionType, LeadStatus } from '@prisma/client';

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  CALL: 'Llamada',
  EMAIL: 'Correo',
  NOTE: 'Nota',
  VISIT: 'Visita',
  WHATSAPP: 'WhatsApp',
};

export const INTERACTION_TYPE_ORDER: InteractionType[] = [
  'CALL',
  'WHATSAPP',
  'EMAIL',
  'VISIT',
  'NOTE',
];

export type CompanyContactRow = {
  leadId: string;
  businessName: string;
  ruc: string | null;
  leadStatus: LeadStatus;
  leadOwnerId: string | null;
  leadOwnerName: string | null;
  city: string | null;
  industry: string | null;
  firstContactAt: Date;
  lastContactAt: Date;
  totalInteractions: number;
  channels: InteractionType[];
  authors: Array<{ id: string; name: string }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type PresetRange = { from: string; to: string };

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function computePresetRange(preset: string, today: Date = new Date()): PresetRange {
  const to = startOfDay(today);
  let from = to;
  switch (preset) {
    case '7d':
      from = new Date(to.getTime() - 6 * DAY_MS);
      break;
    case '30d':
      from = new Date(to.getTime() - 29 * DAY_MS);
      break;
    case '90d':
      from = new Date(to.getTime() - 89 * DAY_MS);
      break;
    case 'month':
      from = startOfMonth(to);
      break;
    case 'quarter':
      from = startOfQuarter(to);
      break;
    case 'year':
      from = startOfYear(to);
      break;
    default:
      return { from: '', to: '' };
  }
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}
