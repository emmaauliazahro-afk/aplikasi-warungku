import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { toNumber, serializeTransaction } from '../utils/serialize';
import { createCustomerSchema, updateCustomerSchema } from '../schemas/customer.schema';

// GET /api/customers - list with optional search + total debt per customer
export async function listCustomers(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const customers = await prisma.customer.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    include: {
      debts: {
        where: { status: { in: ['UNPAID', 'PARTIAL'] } },
        select: { remaining: true },
      },
      _count: { select: { transactions: true } },
    },
  });

  const data = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    createdAt: c.createdAt,
    totalDebt: c.debts.reduce((sum, d) => sum + toNumber(d.remaining), 0),
    transactionCount: c._count.transactions,
  }));

  res.json({ success: true, data });
}

// GET /api/customers/:id - detail with transaction history + outstanding debts
export async function getCustomer(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { _count: { select: { items: true } } },
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
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

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
  const id = Number(req.params.id);
  if (Number.isNaN(id)) throw new ApiError(400, 'ID tidak valid');

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
