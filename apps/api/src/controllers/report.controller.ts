import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { toNumber } from '../utils/serialize';
import { localDateKey } from '../utils/date';
import { csvRow } from '../utils/csv';

const salesQuerySchema = z.object({
  startDate: z.string().max(30).optional(),
  endDate: z.string().max(30).optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBT']).optional(),
});

// Hard caps on unbounded list queries. The export endpoint streams a CSV; the
// dashboard view returns at most EXPORT_LIMIT rows. Increase the constants
// if you grow past this — but always cap.
const REPORT_TX_LIMIT = 1000;
const TOP_PRODUCTS_AGG_LIMIT = 5000;

function buildDateRange(startDate?: string, endDate?: string) {
  const where: { gte?: Date; lte?: Date } = {};
  if (startDate) where.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    where.lte = end;
  }
  return Object.keys(where).length ? where : undefined;
}

function buildSalesWhere(q: z.infer<typeof salesQuerySchema>) {
  const createdAt = buildDateRange(q.startDate, q.endDate);
  const where: {
    status: 'COMPLETED';
    createdAt?: { gte?: Date; lte?: Date };
    paymentMethod?: 'CASH' | 'TRANSFER' | 'DEBT';
  } = { status: 'COMPLETED' };
  if (createdAt) where.createdAt = createdAt;
  if (q.paymentMethod) where.paymentMethod = q.paymentMethod;
  return where;
}

export async function getSalesReport(req: Request, res: Response) {
  const q = salesQuerySchema.parse(req.query);
  const where = buildSalesWhere(q);

  // Run the aggregations + daily rollup in a single round trip per query.
  // We use $queryRaw for the per-day profit/revenue aggregation so we don't
  // pull every row into memory. The "transactions" list is capped.
  const [agg, txCount, profitRow, dailyRows, transactions] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { totalAmount: true, discount: true },
      where,
    }),
    prisma.transaction.count({ where }),
    // Total profit across the range — sum of (price - costPrice) * quantity.
    prisma.$queryRaw<{ profit: number | string | null }[]>`
      SELECT COALESCE(SUM(("price" - "cost_price") * "quantity"), 0)::float AS profit
      FROM "transaction_items" ti
      JOIN "transactions" t ON t."id" = ti."transaction_id"
      WHERE t."status" = 'COMPLETED'
        ${where.createdAt?.gte ? prismaSafeDate(where.createdAt.gte) : prismaSafeNoop()}
        ${where.createdAt?.lte ? prismaSafeDate(where.createdAt.lte) : prismaSafeNoop()}
        ${where.paymentMethod ? prismaSafeMethod(where.paymentMethod) : prismaSafeNoop()}
    `,
    // Per-day rollup (date, revenue, profit, transaction count).
    prisma.$queryRaw<
      { day: string; revenue: number | string; profit: number | string; transactions: number }[]
    >`
      SELECT
        TO_CHAR(t."created_at" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS day,
        COALESCE(SUM(t."total_amount"), 0)::float AS revenue,
        COALESCE(SUM((ti."price" - ti."cost_price") * ti."quantity"), 0)::float AS profit,
        COUNT(t."id")::int AS transactions
      FROM "transactions" t
      LEFT JOIN "transaction_items" ti ON ti."transaction_id" = t."id"
      WHERE t."status" = 'COMPLETED'
        ${where.createdAt?.gte ? prismaSafeDate(where.createdAt.gte) : prismaSafeNoop()}
        ${where.createdAt?.lte ? prismaSafeDate(where.createdAt.lte) : prismaSafeNoop()}
        ${where.paymentMethod ? prismaSafeMethod(where.paymentMethod) : prismaSafeNoop()}
      GROUP BY day
      ORDER BY day ASC
    `,
    prisma.transaction.findMany({
      where,
      include: { customer: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: REPORT_TX_LIMIT,
    }),
  ]);

  const profit = toNumber(profitRow[0]?.profit);

  const daily = dailyRows.map((d) => ({
    date: d.day,
    revenue: toNumber(d.revenue),
    profit: toNumber(d.profit),
    transactions: d.transactions,
  }));

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

// `Prisma.sql` helpers to safely interpolate values into template literals.
// We avoid using `Prisma.sql` directly because mixing Prisma.sql fragments
// with template literals requires re-imports; these wrapper functions build
// safe SQL fragments at the call site.
import { Prisma } from '../generated/prisma/client';
function prismaSafeDate(d: Date) {
  return Prisma.sql`AND t."created_at" >= ${d}`;
}
function prismaSafeMethod(m: 'CASH' | 'TRANSFER' | 'DEBT') {
  return Prisma.sql`AND t."payment_method"::text = ${m}`;
}
function prismaSafeNoop() {
  return Prisma.empty;
}

export async function exportSalesCsv(req: Request, res: Response) {
  const q = salesQuerySchema.parse(req.query);
  const where = buildSalesWhere(q);

  // Streamed via cursor-free findMany but with a defensive take cap.
  const transactions = await prisma.transaction.findMany({
    where,
    include: { customer: { select: { name: true } }, items: true },
    orderBy: { createdAt: 'asc' },
    take: REPORT_TX_LIMIT,
  });

  const header = csvRow([
    'No Transaksi',
    'Tanggal',
    'Pelanggan',
    'Metode Bayar',
    'Subtotal',
    'Diskon',
    'Total',
    'Profit',
  ]);
  const rows = transactions.map((t) => {
    const profit = t.items.reduce(
      (s, i) => s + (toNumber(i.price) - toNumber(i.costPrice)) * i.quantity,
      0
    );
    return csvRow([
      t.transactionNumber,
      localDateKey(t.createdAt),
      t.customer?.name ?? '-',
      t.paymentMethod,
      toNumber(t.subtotal),
      toNumber(t.discount),
      toNumber(t.totalAmount),
      profit,
    ]);
  });

  // RFC 4180 uses CRLF line endings.
  const csv = [header, ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="laporan-penjualan.csv"'
  );
  res.send(csv);
}

const topProductsQuerySchema = z.object({
  startDate: z.string().max(30).optional(),
  endDate: z.string().max(30).optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
  sortBy: z.enum(['quantity', 'revenue']).default('quantity'),
});

export async function getTopProducts(req: Request, res: Response) {
  const q = topProductsQuerySchema.parse(req.query);
  const createdAt = buildDateRange(q.startDate, q.endDate);

  // Single SQL aggregation: group by product, sum quantity and revenue/profit.
  // We cap the scan via createdAt range (caller-controlled) and take LIMIT.
  const rows = await prisma.$queryRaw<
    { product_id: number | null; product_name: string; quantity: number; revenue: number; profit: number }[]
  >`
    SELECT
      ti."product_id",
      ti."product_name",
      SUM(ti."quantity")::int AS quantity,
      COALESCE(SUM(ti."price" * ti."quantity"), 0)::float AS revenue,
      COALESCE(SUM((ti."price" - ti."cost_price") * ti."quantity"), 0)::float AS profit
    FROM "transaction_items" ti
    JOIN "transactions" t ON t."id" = ti."transaction_id"
    WHERE t."status" = 'COMPLETED'
      ${createdAt?.gte ? Prisma.sql`AND t."created_at" >= ${createdAt.gte}` : Prisma.empty}
      ${createdAt?.lte ? Prisma.sql`AND t."created_at" <= ${createdAt.lte}` : Prisma.empty}
    GROUP BY ti."product_id", ti."product_name"
    ORDER BY ${q.sortBy === 'quantity' ? Prisma.sql`quantity DESC` : Prisma.sql`revenue DESC`}
    LIMIT ${TOP_PRODUCTS_AGG_LIMIT}
  `;

  const sorted = rows
    .slice(0, q.limit)
    .map((r, idx) => ({
      rank: idx + 1,
      productId: r.product_id ?? 0,
      name: r.product_name,
      quantity: r.quantity,
      revenue: toNumber(r.revenue),
      profit: toNumber(r.profit),
    }));

  res.json({ success: true, data: sorted });
}
