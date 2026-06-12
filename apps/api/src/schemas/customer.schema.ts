import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Nama pelanggan wajib diisi').max(150),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+\-\s()]*$/, 'Nomor telepon tidak valid')
    .optional()
    .nullable(),
  address: z.string().trim().max(500).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().trim().max(100).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
