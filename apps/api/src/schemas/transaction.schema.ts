import { z } from 'zod';
import { PaymentMethod, TransactionStatus } from '../generated/prisma/enums';

export const transactionItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive('Jumlah harus lebih dari 0').max(100_000),
});

export const createTransactionSchema = z
  .object({
    items: z
      .array(transactionItemSchema)
      .min(1, 'Minimal 1 produk dalam transaksi')
      .max(200, 'Maksimal 200 item per transaksi'),
    paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBT']) satisfies z.ZodType<PaymentMethod>,
    discount: z.coerce.number().min(0).max(1_000_000_000).default(0),
    paidAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
    customerId: z.number().int().positive().optional().nullable(),
    note: z.string().trim().max(500).optional(),
    dueDate: z.string().datetime().optional(), // for DEBT
  })
  .refine((d) => d.paymentMethod !== 'DEBT' || !!d.customerId, {
    message: 'Transaksi hutang wajib memilih pelanggan',
    path: ['customerId'],
  });

export const listTransactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(100).optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBT']).optional() satisfies z.ZodType<PaymentMethod | undefined>,
  status: z.enum(['COMPLETED', 'CANCELLED']).optional() satisfies z.ZodType<TransactionStatus | undefined>,
  startDate: z.string().max(30).optional(),
  endDate: z.string().max(30).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
