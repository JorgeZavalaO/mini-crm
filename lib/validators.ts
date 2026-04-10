import {
  CurrencyCode,
  InteractionType,
  LeadStatus,
  QuoteStatus,
  ReassignmentStatus,
  TaskPriority,
  TaskStatus,
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
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100),
    confirmPassword: z.string().min(8, 'Confirma la contraseña').max(100),
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
  gerente: optionalText(200),
  contactName: optionalText(200),
  contactPhone: optionalText(40),
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
  gerente: optionalText(200),
  contactName: optionalText(200),
  contactPhone: optionalText(40),
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

export const updateInteractionSchema = z.object({
  tenantSlug: z.string().min(1),
  interactionId: z.string().min(1),
  type: z.nativeEnum(InteractionType),
  subject: optionalText(200),
  notes: z.string().trim().min(1, 'Las notas son requeridas').max(5000),
  occurredAt: z.coerce.date(),
});

export const deleteInteractionSchema = z.object({
  tenantSlug: z.string().min(1),
  interactionId: z.string().min(1),
});

export const interactionFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const ownerHistoryFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const uploadDocumentSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1).optional(),
});

export const documentFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: optionalId,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
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
  taxExempt: z.boolean().optional().default(false),
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

// ─── Tasks ──────────────────────────────────────────────

export const createTaskSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: optionalId,
  assignedToId: optionalId,
  title: z.string().trim().min(1, 'El título es requerido').max(300),
  description: optionalText(5000),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.coerce.date().optional(),
});

export const updateTaskSchema = createTaskSchema.extend({
  taskId: z.string().min(1),
});

export const changeTaskStatusSchema = z.object({
  tenantSlug: z.string().min(1),
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
});

export const deleteTaskSchema = z.object({
  tenantSlug: z.string().min(1),
  taskId: z.string().min(1),
});

export const taskFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: optionalId,
  assignedToId: optionalId,
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  scope: z.enum(['mine', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Products ──────────────────────────────────────────

export const createProductSchema = z.object({
  tenantSlug: z.string().min(1),
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1, 'El nombre es requerido').max(200),
  description: optionalText(500),
  unitPrice: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0'),
  currency: z.nativeEnum(CurrencyCode).default(CurrencyCode.PEN),
  taxExempt: z.boolean().default(false),
});

export const updateProductSchema = z.object({
  tenantSlug: z.string().min(1),
  productId: z.string().min(1),
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1, 'El nombre es requerido').max(200).optional(),
  description: optionalText(500),
  unitPrice: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0').optional(),
  currency: z.nativeEnum(CurrencyCode).optional(),
  isActive: z.boolean().optional(),
  taxExempt: z.boolean().optional(),
});

export const deleteProductSchema = z.object({
  tenantSlug: z.string().min(1),
  productId: z.string().min(1),
});

// ─── Company profile ───────────────────────────────────

export const updateCompanyProfileSchema = z.object({
  tenantSlug: z.string().min(1),
  companyName: optionalText(200),
  companyRuc: optionalText(20),
  companyAddress: optionalText(400),
  companyPhone: optionalText(50),
  companyEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .pipe(z.string().email('Email corporativo inválido').optional()),
  companyWebsite: optionalText(200),
  companyTimezone: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Zona horaria inválida' },
    )
    .default('America/Lima'),
});

export const productFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  q: optionalText(120),
  isActive: z.boolean().optional(),
  currency: z.nativeEnum(CurrencyCode).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const sendQuoteEmailSchema = z.object({
  tenantSlug: z.string().min(1),
  quoteId: z.string().min(1),
  recipientEmail: z.string().email('El email no es válido'),
});

// ─── Notifications ─────────────────────────────────────

export const markNotificationReadSchema = z.object({
  tenantSlug: z.string().min(1),
  notificationId: z.string().min(1),
});

export const deleteNotificationSchema = z.object({
  tenantSlug: z.string().min(1),
  notificationId: z.string().min(1),
});

export const notificationFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  isRead: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Portal ────────────────────────────────────────────

export const createPortalTokenSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
});

export const revokePortalTokenSchema = z.object({
  tenantSlug: z.string().min(1),
  tokenId: z.string().min(1),
});

export const portalTokenFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  leadId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
