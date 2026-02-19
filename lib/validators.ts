import { z } from 'zod';

export const emailSchema = z.string().email();

export const createLeadSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
