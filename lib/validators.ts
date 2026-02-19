import { z } from 'zod';

export const emailSchema = z.string().email();

export const loginSchema = z.object({
  slug: z.string().min(1, 'El slug es requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const createLeadSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
