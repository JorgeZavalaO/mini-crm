import {
  CurrencyCode,
  InteractionType,
  LeadStatus,
  QuoteStatus,
  ReassignmentStatus,
} from '@prisma/client';
import { z } from 'zod';
import { ROLES } from '@/lib/rbac';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalId = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const nullableId = z.union([z.string().trim().min(1), z.null()]).optional();

export const emailSchema = z.string().email();

export const loginSchema = z.object({
  slug: z.string().min(1, 'El slug es requerido'),
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'La contrasena es requerida'),
});

export const createTeamInvitationSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  email: z
    .string()
    .trim()
    .email('Email invalido')
    .max(200)
    .transform((value) => value.toLowerCase()),
  role: z.enum(ROLES),
});

export const acceptTeamInvitationSchema = z
  .object({
    token: z.string().trim().min(20, 'Invitación inválida').max(255),
    name: z.string().trim().min(2, 'Ingresa tu nombre').max(120),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100),
    confirmPassword: z.string().min(6, 'Confirma la contraseña').max(100),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export const createLeadSchema = z.object({
  tenantSlug: z.string().min(1),
  businessName: z.string().trim().min(1, 'La razon social es requerida').max(200),
  ruc: optionalText(40),
  country: optionalText(80),
  city: optionalText(120),
  industry: optionalText(120),
  source: optionalText(120),
  notes: optionalText(5000),
  phones: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  emails: z.array(z.string().trim().email().max(200)).max(20).default([]),
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  ownerId: nullableId,
});

export const updateLeadSchema = createLeadSchema.extend({
  leadId: z.string().min(1),
});

export const leadFiltersSchema = z.object({
  q: optionalText(120),
  status: z.nativeEnum(LeadStatus).optional(),
  ownerId: optionalId,
  source: optionalText(120),
  city: optionalText(120),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const archiveLeadSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
});

export const assignLeadSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
  ownerId: z.string().min(1),
});

export const bulkAssignSchema = z.object({
  tenantSlug: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  ownerId: z.string().min(1),
});

export const importCsvSchema = z.object({
  tenantSlug: z.string().min(1),
  csvText: z.string().trim().min(1, 'Pega un CSV con encabezados').max(250_000),
});

export const importLeadRowSchema = z.object({
  businessName: optionalText(200),
  ruc: z.string().trim().min(1, 'El RUC/código es requerido').max(40),
  country: optionalText(80),
  city: optionalText(120),
  industry: optionalText(120),
  source: optionalText(120),
  notes: optionalText(5000),
  phones: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  emails: z.array(z.string().trim().email().max(200)).max(20).default([]),
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  ownerEmail: z
    .string()
    .trim()
    .email('Owner email invalido')
    .max(200)
    .optional()
    .transform((value) => (value && value.length > 0 ? value.toLowerCase() : undefined)),
});

export const mergeDuplicateLeadsSchema = z.object({
  tenantSlug: z.string().min(1),
  primaryLeadId: z.string().min(1),
  duplicateLeadIds: z.array(z.string().min(1)).min(1).max(20),
});

export const requestReassignSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
  requestedOwnerId: nullableId,
  reason: z.string().trim().min(5, 'Describe brevemente el motivo').max(1000),
});

export const resolveReassignSchema = z.object({
  tenantSlug: z.string().min(1),
  requestId: z.string().min(1),
  status: z.enum([ReassignmentStatus.APPROVED, ReassignmentStatus.REJECTED]),
  ownerId: nullableId,
  resolutionNote: optionalText(1000),
});

export const createInteractionSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
  type: z.nativeEnum(InteractionType),
  subject: optionalText(200),
  notes: z.string().trim().min(1, 'Las notas son requeridas').max(5000),
  occurredAt: z.coerce.date(),
  targetStatus: z.nativeEnum(LeadStatus).optional(),
});

export const updateInteractionSchema = createInteractionSchema.extend({
  interactionId: z.string().min(1),
});

export const deleteInteractionSchema = z.object({
  tenantSlug: z.string().min(1),
  interactionId: z.string().min(1),
});

export const uploadDocumentSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1).optional(),
});

export const deleteDocumentSchema = z.object({
  tenantSlug: z.string().min(1),
  documentId: z.string().min(1),
});

const quoteItemSchema = z.object({
  description: z.string().trim().min(1, 'La descripción del item es requerida').max(500),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0').max(999999),
  unitPrice: z.coerce
    .number()
    .nonnegative('El precio unitario no puede ser negativo')
    .max(999999999),
});

export const createQuoteSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
  currency: z.nativeEnum(CurrencyCode).default(CurrencyCode.PEN),
  taxRate: z.coerce.number().min(0).max(1).default(0.18),
  validUntil: z.coerce.date().optional(),
  notes: optionalText(5000),
  items: z.array(quoteItemSchema).min(1, 'Debe incluir al menos un item').max(100),
});

export const updateQuoteSchema = createQuoteSchema.extend({
  quoteId: z.string().min(1),
});

export const changeQuoteStatusSchema = z.object({
  tenantSlug: z.string().min(1),
  quoteId: z.string().min(1),
  status: z.enum([QuoteStatus.ENVIADA, QuoteStatus.ACEPTADA, QuoteStatus.RECHAZADA]),
});

export const deleteQuoteSchema = z.object({
  tenantSlug: z.string().min(1),
  quoteId: z.string().min(1),
});

export const quoteFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: optionalId,
  status: z.nativeEnum(QuoteStatus).optional(),
  q: optionalText(120),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
