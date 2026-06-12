import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { toNumber, serializeTransaction } from '../utils/serialize';
import { parseIdParam } from '../utils/params';
import {
  createCustomerSchema,
  listCustomerQuerySchema,
  updateCustomerSchema,
} from '../schemas/customer.schema';

// GET /api/customers - list with optional search + total debt per customer
export async function listCustomers(req: Request, res: Response) {
  const q = listCustomerQuerySchema.parse(req.query);

  const where = q.search
    ? { name: { contains: q.search, mode: 'insensitive' as const } }
    : undefined;

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        debts: {
          where: { status: { in: ['UNPAID', 'PARTIAL'] } },
          select: { remaining: true },
        },
        _count: { select: { transactions: true } },
      },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
  ]);

  const data = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    createdAt: c.createdAt,
    totalDebt: c.debts.reduce((sum, d) => sum + toNumber(d.remaining), 0),
    transactionCount: c._count.transactions,
  }));

  res.json({
    success: true,
    data,
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  });
}

// GET /api/customers/:id - detail with transaction history + outstanding debts
export async function getCustomer(req: Request, res: Response) {
  const id = parseIdParam(req);

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          items: true,
          customer: true,
          debt: true,
          _count: { select: { items: true } },
        },
      },
      debts: {
        orderBy: { createdAt: 'desc' },
        include: { payments: true },
      },
    },
  });
  if (!customer) throw new ApiError(404, 'Pelanggan tidak ditemukan');

  const totalDebt = customer.debts
    .filter((d) => d.status !== 'PAID')
    .reduce((sum, d) => sum + toNumber(d.remaining), 0);

  res.json({
    success: true,
    data: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
      totalDebt,
      transactions: customer.transactions.map(serializeTransaction),
      debts: customer.debts.map((d) => ({
        ...d,
        amount: toNumber(d.amount),
        paidAmount: toNumber(d.paidAmount),
        remaining: toNumber(d.remaining),
      })),
    },
  });
}

// POST /api/customers
export async function createCustomer(req: Request, res: Response) {
  const data = createCustomerSchema.parse(req.body);
  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone ?? null,
      address: data.address ?? null,
    },
  });
  res.status(201).json({ success: true, data: customer });
}

// PUT /api/customers/:id
export async function updateCustomer(req: Request, res: Response) {
  const id = parseIdParam(req);

  const data = updateCustomerSchema.parse(req.body);
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Pelanggan tidak ditemukan');

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
    },
  });
  res.json({ success: true, data: customer });
}

// DELETE /api/customers/:id
export async function deleteCustomer(req: Request, res: Response) {
  const id = parseIdParam(req);

  const existing = await prisma.customer.findUnique({
    where: { id },
    include: {
      debts: { where: { status: { in: ['UNPAID', 'PARTIAL'] } } },
    },
  });
  if (!existing) throw new ApiError(404, 'Pelanggan tidak ditemukan');

  // Prevent deletion if customer still has outstanding debt
  if (existing.debts.length > 0) {
    throw new ApiError(400, 'Tidak dapat menghapus pelanggan yang masih memiliki hutang');
  }

  await prisma.customer.delete({ where: { id } });
  res.json({ success: true, message: 'Pelanggan berhasil dihapus' });
}
