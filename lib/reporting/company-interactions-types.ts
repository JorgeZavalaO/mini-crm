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
