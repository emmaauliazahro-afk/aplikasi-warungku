import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Nama pelanggan wajib diisi'),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
