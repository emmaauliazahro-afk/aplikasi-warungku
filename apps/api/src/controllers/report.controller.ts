import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { toNumber } from '../utils/serialize';
import { localDateKey } from '../utils/date';

const salesQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBT']).optional(),
});

function buildDateRange(startDate?: string, endDate?: string) {
  const where: Record<string, unknown> = {};
  if (startDate) where.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    where.lte = end;
  }
  return Object.keys(where).length ? where : undefined;
}

export async function getSalesReport(req: Request, res: Response) {
  const q = salesQuerySchema.parse(req.query);
  const createdAt = buildDateRange(q.startDate, q.endDate);

  const where: Record<string, unknown> = { status: 'COMPLETED' };
  if (createdAt) where.createdAt = createdAt;
  if (q.paymentMethod) where.paymentMethod = q.paymentMethod;

  const [agg, txCount, transactions] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { totalAmount: true, discount: true },
      where: where as never,
    }),
    prisma.transaction.count({ where: where as never }),
    prisma.transaction.findMany({
      where: where as never,
      include: { customer: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  // profit = sum(item.subtotal - item.quantity * item.costPrice) across all matching tx
  const items = await prisma.transactionItem.findMany({
    where: { transaction: where as never },
    select: { quantity: true, price: true, costPrice: true },
  });
  const profit = items.reduce(
    (sum, i) => sum + (toNumber(i.price) - toNumber(i.costPrice)) * i.quantity,
    0
  );

  // daily breakdown
  const dailyMap = new Map<string, { revenue: number; transactions: number; profit: number }>();
  // need per-tx data for daily grouping
  const txsForDaily = await prisma.transaction.findMany({
    where: where as never,
    select: { createdAt: true, totalAmount: true, items: { select: { quantity: true, price: true, costPrice: true } } },
  });
  for (const tx of txsForDaily) {
    const day = localDateKey(tx.createdAt);
    const entry = dailyMap.get(day) ?? { revenue: 0, transactions: 0, profit: 0 };
    entry.revenue += toNumber(tx.totalAmount);
    entry.transactions += 1;
    entry.profit += tx.items.reduce((s, i) => s + (toNumber(i.price) - toNumber(i.costPrice)) * i.quantity, 0);
    dailyMap.set(day, entry);
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }));

  res.json({
    success: true,
    data: {
      summary: {
        revenue: toNumber(agg._sum.totalAmount),
        discount: toNumber(agg._sum.discount),
        profit,
        transactions: txCount,
      },
      daily,
      transactions: transactions.map((t) => ({
        id: t.id,
        transactionNumber: t.transactionNumber,
        createdAt: t.createdAt,
        totalAmount: toNumber(t.totalAmount),
        paymentMethod: t.paymentMethod,
        customer: t.customer?.name ?? null,
        itemCount: t._count.items,
      })),
    },
  });
}

export async function exportSalesCsv(req: Request, res: Response) {
  const q = salesQuerySchema.parse(req.query);
  const createdAt = buildDateRange(q.startDate, q.endDate);

  const where: Record<string, unknown> = { status: 'COMPLETED' };
  if (createdAt) where.createdAt = createdAt;
  if (q.paymentMethod) where.paymentMethod = q.paymentMethod;

  const transactions = await prisma.transaction.findMany({
    where: where as never,
    include: { customer: { select: { name: true } }, items: true },
    orderBy: { createdAt: 'asc' },
  });

  const header = 'No Transaksi,Tanggal,Pelanggan,Metode Bayar,Subtotal,Diskon,Total,Profit';
  const rows = transactions.map((t) => {
    const profit = t.items.reduce((s, i) => s + (toNumber(i.price) - toNumber(i.costPrice)) * i.quantity, 0);
    return [
      t.transactionNumber,
      localDateKey(t.createdAt),
      t.customer?.name ?? '-',
      t.paymentMethod,
      toNumber(t.subtotal),
      toNumber(t.discount),
      toNumber(t.totalAmount),
      profit,
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=laporan-penjualan.csv');
  res.send(csv);
}

const topProductsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
  sortBy: z.enum(['quantity', 'revenue']).default('quantity'),
});

export async function getTopProducts(req: Request, res: Response) {
  const q = topProductsQuerySchema.parse(req.query);
  const createdAt = buildDateRange(q.startDate, q.endDate);

  const where: Record<string, unknown> = { transaction: { status: 'COMPLETED' } };
  if (createdAt) where.transaction = { status: 'COMPLETED', createdAt };

  const items = await prisma.transactionItem.findMany({
    where: where as never,
    select: { productId: true, productName: true, quantity: true, price: true, costPrice: true },
  });

  // aggregate by productId
  const map = new Map<number, { name: string; quantity: number; revenue: number; profit: number }>();
  for (const i of items) {
    const pid = i.productId ?? 0;
    const e = map.get(pid) ?? { name: i.productName, quantity: 0, revenue: 0, profit: 0 };
    e.quantity += i.quantity;
    const rev = toNumber(i.price) * i.quantity;
    e.revenue += rev;
    e.profit += rev - toNumber(i.costPrice) * i.quantity;
    map.set(pid, e);
  }

  const sorted = [...map.entries()]
    .sort((a, b) => b[1][q.sortBy] - a[1][q.sortBy])
    .slice(0, q.limit)
    .map(([productId, d], idx) => ({ rank: idx + 1, productId, ...d }));

  res.json({ success: true, data: sorted });
}
