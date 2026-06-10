import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { toNumber } from '../utils/serialize';
import { localDateKey } from '../utils/date';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

// GET /api/dashboard/stats
export async function getStats(_req: Request, res: Response) {
  const todayStart = startOfToday();
  const weekStart = daysAgo(6); // last 7 days inclusive of today

  const [
    todayAgg,
    todayCount,
    lowStockCount,
    totalProducts,
    debtAgg,
    customerCount,
    weekTransactions,
  ] = await Promise.all([
    // Today's revenue (completed only)
    prisma.transaction.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'COMPLETED', createdAt: { gte: todayStart } },
    }),
    // Today's transaction count
    prisma.transaction.count({
      where: { status: 'COMPLETED', createdAt: { gte: todayStart } },
    }),
    // Low stock products
    prisma.product.count({
      where: { isActive: true, stock: { lte: prisma.product.fields.minStock } },
    }),
    // Total active products
    prisma.product.count({ where: { isActive: true } }),
    // Outstanding debt (not fully paid)
    prisma.debt.aggregate({
      _sum: { remaining: true },
      where: { status: { in: ['UNPAID', 'PARTIAL'] } },
    }),
    // Total customers
    prisma.customer.count(),
    // Transactions in the last 7 days for the trend chart
    prisma.transaction.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: weekStart } },
      select: { totalAmount: true, createdAt: true },
    }),
  ]);

  // Build 7-day revenue trend (date -> revenue)
  const trendMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    trendMap.set(localDateKey(d), 0);
  }
  for (const t of weekTransactions) {
    const key = localDateKey(t.createdAt);
    if (trendMap.has(key)) {
      trendMap.set(key, trendMap.get(key)! + toNumber(t.totalAmount));
    }
  }
  const salesTrend = Array.from(trendMap.entries()).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  res.json({
    success: true,
    data: {
      todayRevenue: toNumber(todayAgg._sum.totalAmount),
      todayTransactions: todayCount,
      lowStockCount,
      totalProducts,
      totalDebt: toNumber(debtAgg._sum.remaining),
      totalCustomers: customerCount,
      salesTrend,
    },
  });
}
