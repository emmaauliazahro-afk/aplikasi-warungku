import { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { toNumber } from '../utils/serialize';
import { debtPaymentSchema, listDebtQuerySchema } from '../schemas/debt.schema';
import { computeDebtFields } from '../utils/calc';

function serializeDebt(d: {
  amount: unknown;
  paidAmount: unknown;
  remaining: unknown;
  [key: string]: unknown;
}) {
  return {
    ...d,
    amount: toNumber(d.amount),
    paidAmount: toNumber(d.paidAmount),
    remaining: toNumber(d.remaining),
  };
}

// GET /api/debts - list with filters + summary
export async function listDebts(req: Request, res: Response) {
  const q = listDebtQuerySchema.parse(req.query);

  const where: Prisma.DebtWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.customerId) where.customerId = q.customerId;

  const [total, debts, outstandingAgg] = await Promise.all([
    prisma.debt.count({ where }),
    prisma.debt.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        transaction: { select: { transactionNumber: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    // total outstanding across all (ignores pagination/status filter)
    prisma.debt.aggregate({
      _sum: { remaining: true },
      where: { status: { in: ['UNPAID', 'PARTIAL'] } },
    }),
  ]);

  res.json({
    success: true,
    data: debts.map(serializeDebt),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
      totalOutstanding: toNumber(outstandingAgg._sum.remaining),
    },
  });
}

// GET /api/debts/:id - detail with payment history
export async function getDebt(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const debt = await prisma.debt.findUnique({
    where: { id },
    include: {
      customer: true,
      transaction: { include: { items: true } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!debt) throw new ApiError(404, 'Hutang tidak ditemukan');

  res.json({
    success: true,
    data: {
      ...serializeDebt(debt),
      payments: debt.payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
    },
  });
}

// POST /api/debts/:id/payment - record an installment payment
export async function recordPayment(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const data = debtPaymentSchema.parse(req.body);

  const debt = await prisma.debt.findUnique({ where: { id } });
  if (!debt) throw new ApiError(404, 'Hutang tidak ditemukan');

  if (debt.status === 'PAID') {
    throw new ApiError(400, 'Hutang ini sudah lunas');
  }

  const remaining = toNumber(debt.remaining);
  if (data.amount > remaining) {
    throw new ApiError(400, `Pembayaran melebihi sisa hutang (sisa ${remaining})`);
  }

  const newPaid = toNumber(debt.paidAmount) + data.amount;
  const { remaining: newRemaining, status: newStatus } = computeDebtFields(
    toNumber(debt.amount),
    newPaid
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.debtPayment.create({
      data: { debtId: id, amount: data.amount, note: data.note },
    });
    return tx.debt.update({
      where: { id },
      data: { paidAmount: newPaid, remaining: newRemaining, status: newStatus },
      include: {
        customer: { select: { id: true, name: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
  });

  res.json({
    success: true,
    data: {
      ...serializeDebt(updated),
      payments: updated.payments.map((p) => ({ ...p, amount: toNumber(p.amount) })),
    },
    message: newStatus === 'PAID' ? 'Hutang lunas!' : 'Pembayaran berhasil dicatat',
  });
}
