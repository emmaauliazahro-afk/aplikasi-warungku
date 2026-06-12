import { z } from 'zod';
import { DebtStatus } from '../generated/prisma/enums';

export const debtPaymentSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Jumlah pembayaran harus lebih dari 0')
    .max(1_000_000_000),
  note: z.string().trim().max(500).optional(),
});

export const listDebtQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional() satisfies z.ZodType<DebtStatus | undefined>,
  customerId: z.coerce.number().int().positive().optional(),
});

export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;
