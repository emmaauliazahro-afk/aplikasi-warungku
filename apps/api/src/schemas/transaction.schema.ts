import { z } from 'zod';

export const transactionItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive('Jumlah harus lebih dari 0'),
});

export const createTransactionSchema = z
  .object({
    items: z.array(transactionItemSchema).min(1, 'Minimal 1 produk dalam transaksi'),
    paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBT']),
    discount: z.coerce.number().min(0).default(0),
    paidAmount: z.coerce.number().min(0).default(0),
    customerId: z.number().int().positive().optional().nullable(),
    note: z.string().trim().optional(),
    dueDate: z.string().datetime().optional(), // for DEBT
  })
  .refine((d) => d.paymentMethod !== 'DEBT' || !!d.customerId, {
    message: 'Transaksi hutang wajib memilih pelanggan',
    path: ['customerId'],
  });

export const listTransactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBT']).optional(),
  status: z.enum(['COMPLETED', 'CANCELLED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
